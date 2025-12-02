import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Plus, Minus, Trash2, Upload, AlertCircle } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { calculateSampleSize, getAQLLimits, COMMON_DEFECTS, AQL_STANDARDS } from '../lib/aqlCalculations';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000';

interface FinalInspectionFormProps {
  inspectionId?: string;
  onClose: () => void;
}

interface Customer {
  id: string;
  name: string;
}

interface TemplatePOM {
  id: string;
  name: string;
  default_tol: number;
  default_std: number;
}

interface Template {
  id: string;
  name: string;
  poms: TemplatePOM[];
}

interface SizeCheck {
  size: string;
  order_qty: number;
  packed_qty: number;
}

interface MeasurementInput {
  pom_name: string;
  spec: number;
  tol: number;
  s1: string;
  s2: string;
  s3: string;
  s4: string;
  s5: string;
}

interface FormData {
  customer: string;
  supplier: string;
  factory: string;
  template: string; // Added template selection
  inspection_date: string;
  order_no: string;
  style_no: string;
  color: string;
  aql_standard: 'strict' | 'standard';
  total_order_qty: number;
  presented_qty: number;
  sample_size: number;
  total_cartons: number;
  selected_cartons: number;
  carton_length: number;
  carton_width: number;
  carton_height: number;
  gross_weight: number;
  net_weight: number;
  remarks: string;
  size_checks: SizeCheck[]; // For Quantity Breakdown
  measurements: MeasurementInput[]; // For Garment Dimensions
}

export default function FinalInspectionForm({ inspectionId, onClose }: FinalInspectionFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = localStorage.getItem('access_token');

  const [defectCounts, setDefectCounts] = useState<Record<string, { critical: number; major: number; minor: number }>>(() => {
    const initial: Record<string, { critical: number; major: number; minor: number }> = {};
    COMMON_DEFECTS.forEach(defect => {
      initial[defect] = { critical: 0, major: 0, minor: 0 };
    });
    return initial;
  });

  const [customDefect, setCustomDefect] = useState('');
  const [uploadedImages, setUploadedImages] = useState<Array<{ file: File; caption: string; category: string }>>([]);

  // --- Queries ---

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/customers/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    },
  });

  const { data: templates } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/templates/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    },
  });

  // --- Form Setup ---

  const { register, control, handleSubmit, watch, setValue } = useForm<FormData>({
    defaultValues: {
      inspection_date: new Date().toISOString().split('T')[0],
      aql_standard: 'standard',
      sample_size: 0,
      total_order_qty: 0,
      presented_qty: 0,
      total_cartons: 0,
      selected_cartons: 0,
      carton_length: 0,
      carton_width: 0,
      carton_height: 0,
      gross_weight: 0,
      net_weight: 0,
      size_checks: [{ size: '', order_qty: 0, packed_qty: 0 }],
      measurements: [],
    },
  });

  // Field Arrays
  const { fields: sizeFields, append: appendSize, remove: removeSize } = useFieldArray({
    control,
    name: 'size_checks',
  });

  const { fields: measurementFields, replace: replaceMeasurements } = useFieldArray({
    control,
    name: 'measurements',
  });

  // --- Watchers ---
  const presentedQty = watch('presented_qty');
  const sampleSize = watch('sample_size');
  const aqlStandard = watch('aql_standard');
  const selectedTemplateId = watch('template');
  const measurements = watch('measurements');

  // --- Effects ---

  // 1. Auto-calculate sample size based on PRESENTED QTY
  useEffect(() => {
    if (presentedQty && !inspectionId) {
      const calculatedSize = calculateSampleSize(presentedQty);
      setValue('sample_size', calculatedSize);
    }
  }, [presentedQty, setValue, inspectionId]);

  // 2. Populate Measurement Chart when Template is selected
  useEffect(() => {
    if (selectedTemplateId && templates) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        const newMeasurements = template.poms.map(pom => ({
          pom_name: pom.name,
          spec: pom.default_std,
          tol: pom.default_tol,
          s1: '', s2: '', s3: '', s4: '', s5: ''
        }));
        replaceMeasurements(newMeasurements);
      }
    }
  }, [selectedTemplateId, templates, replaceMeasurements]);

  // --- Calculations ---

  const getTotalDefects = () => {
    let critical = 0, major = 0, minor = 0;
    Object.values(defectCounts).forEach(counts => {
      critical += counts.critical;
      major += counts.major;
      minor += counts.minor;
    });
    return { critical, major, minor };
  };

  const totals = getTotalDefects();
  const currentStandard = AQL_STANDARDS[aqlStandard] || AQL_STANDARDS.standard;

  const maxCritical = getAQLLimits(sampleSize || 0, currentStandard.critical);
  const maxMajor = getAQLLimits(sampleSize || 0, currentStandard.major);
  const maxMinor = getAQLLimits(sampleSize || 0, currentStandard.minor);

  const getResultStatus = (): 'Pass' | 'Fail' => {
    if (totals.critical > maxCritical || totals.major > maxMajor || totals.minor > maxMinor) {
      return 'Fail';
    }
    return 'Pass';
  };

  // Helper to check tolerance
  const isOutOfTolerance = (value: string, spec: number, tol: number) => {
    if (!value || value === '') return false;
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return false;
    return Math.abs(numVal - spec) > tol;
  };

  // --- Handlers ---

  const updateDefectCount = (defect: string, severity: 'critical' | 'major' | 'minor', delta: number) => {
    setDefectCounts(prev => ({
      ...prev,
      [defect]: {
        ...prev[defect],
        [severity]: Math.max(0, prev[defect][severity] + delta),
      }
    }));
  };

  const addCustomDefect = () => {
    if (customDefect && !defectCounts[customDefect]) {
      setDefectCounts(prev => ({ ...prev, [customDefect]: { critical: 0, major: 0, minor: 0 } }));
      setCustomDefect('');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files).map(file => ({
        file,
        caption: '',
        category: 'General',
      }));
      setUploadedImages(prev => [...prev, ...newImages]);
    }
  };

  // Submit form
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // 1. Prepare defects array
      const defects = Object.entries(defectCounts)
        .flatMap(([description, counts]) => [
          ...(counts.critical > 0 ? [{ description, severity: 'Critical', count: counts.critical }] : []),
          ...(counts.major > 0 ? [{ description, severity: 'Major', count: counts.major }] : []),
          ...(counts.minor > 0 ? [{ description, severity: 'Minor', count: counts.minor }] : []),
        ]);

      const payload = { ...data, defects };

      // 2. Create Inspection Record
      const response = await axios.post(`${API_URL}/final-inspections/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // 3. Upload images
      for (const img of uploadedImages) {
        const formData = new FormData();
        formData.append('image', img.file);
        formData.append('caption', img.caption);
        formData.append('category', img.category);

        await axios.post(`${API_URL}/final-inspections/${response.data.id}/upload_image/`, formData, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finalInspections'] });
      toast({ title: 'Final Inspection created successfully!' });
      onClose();
    },
    onError: (error: any) => {
      console.error(error);
      toast({ title: 'Failed to create report', description: error.message, variant: 'destructive' });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex justify-between items-center sticky top-0 bg-white z-20 p-4 shadow-sm border-b">
        <h2 className="text-2xl font-bold text-gray-800">New Final Inspection</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
            {createMutation.isPending ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </div>

      {/* Section 1: General Information */}
      <Card>
        <CardHeader>
          <CardTitle>1. General Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>Customer *</Label>
            <select {...register('customer', { required: true })} className="w-full border rounded p-2 mt-1">
              <option value="">Select Customer</option>
              {customers?.map((c: Customer) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Inspection Date *</Label>
            <Input type="date" {...register('inspection_date', { required: true })} className="mt-1" />
          </div>
          <div>
            <Label>Template (For Measurements)</Label>
            <select {...register('template')} className="w-full border rounded p-2 mt-1">
              <option value="">Select Template</option>
              {templates?.map((t: Template) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Order No *</Label>
            <Input {...register('order_no', { required: true })} placeholder="PO-12345" className="mt-1" />
          </div>
          <div>
            <Label>Style No *</Label>
            <Input {...register('style_no', { required: true })} placeholder="STY-001" className="mt-1" />
          </div>
          <div>
            <Label>Color</Label>
            <Input {...register('color')} placeholder="Navy Blue" className="mt-1" />
          </div>

          {/* AQL Setup Block */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-blue-50 p-4 rounded-md border border-blue-100 mt-2">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> AQL Sampling Setup
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-blue-800">AQL Standard</Label>
                <select {...register('aql_standard')} className="w-full border border-blue-200 rounded p-2 mt-1 bg-white">
                  <option value="standard">Standard (0 / 2.5 / 4.0)</option>
                  <option value="strict">Strict (0 / 1.5 / 2.5)</option>
                </select>
              </div>
              <div>
                <Label className="text-blue-800">Total Order Qty</Label>
                <Input type="number" {...register('total_order_qty', { valueAsNumber: true })} className="mt-1 bg-white" />
              </div>
              <div>
                <Label className="text-blue-800">Presented Qty (Lot Size) *</Label>
                <Input type="number" {...register('presented_qty', { required: true, valueAsNumber: true })} className="mt-1 border-blue-300 bg-white" />
                <p className="text-xs text-blue-600 mt-1">Sample size calculated on this qty</p>
              </div>
              <div>
                <Label className="text-blue-800 font-bold">Required Sample Size</Label>
                <Input type="number" {...register('sample_size', { valueAsNumber: true })} readOnly className="bg-gray-100 mt-1 font-bold text-lg" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: AQL Status */}
      <Card className="border-t-4 border-t-blue-600">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>2. Live AQL Result</CardTitle>
          <Badge className={getResultStatus() === 'Pass' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} style={{ fontSize: '1.2rem', padding: '0.5rem 1.5rem' }}>
            {getResultStatus().toUpperCase()}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Critical Card */}
            <div className={`p-4 rounded-lg border-2 transition-all ${totals.critical > maxCritical ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-gray-700">Critical (0.0)</span>
                <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">Max: {maxCritical}</span>
              </div>
              <div className="text-4xl font-bold text-gray-900">{totals.critical}</div>
              <p className={`text-xs mt-1 font-bold ${totals.critical > maxCritical ? 'text-red-600' : 'text-green-600'}`}>
                {totals.critical > maxCritical ? 'FAILED' : 'WITHIN LIMIT'}
              </p>
            </div>

            {/* Major Card */}
            <div className={`p-4 rounded-lg border-2 transition-all ${totals.major > maxMajor ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-gray-700">Major ({currentStandard.major})</span>
                <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">Max: {maxMajor}</span>
              </div>
              <div className="text-4xl font-bold text-gray-900">{totals.major}</div>
              <p className={`text-xs mt-1 font-bold ${totals.major > maxMajor ? 'text-red-600' : 'text-green-600'}`}>
                {totals.major > maxMajor ? 'FAILED' : 'WITHIN LIMIT'}
              </p>
            </div>

            {/* Minor Card */}
            <div className={`p-4 rounded-lg border-2 transition-all ${totals.minor > maxMinor ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-gray-700">Minor ({currentStandard.minor})</span>
                <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">Max: {maxMinor}</span>
              </div>
              <div className="text-4xl font-bold text-gray-900">{totals.minor}</div>
              <p className={`text-xs mt-1 font-bold ${totals.minor > maxMinor ? 'text-red-600' : 'text-green-600'}`}>
                {totals.minor > maxMinor ? 'FAILED' : 'WITHIN LIMIT'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Quantity Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>3. Quantity Breakdown (Size Check)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 font-semibold text-xs uppercase text-gray-500 mb-1">
              <div className="col-span-3">Size</div>
              <div className="col-span-3">Order Qty</div>
              <div className="col-span-3">Packed Qty</div>
              <div className="col-span-2">Deviation</div>
              <div className="col-span-1"></div>
            </div>

            {sizeFields.map((field, index) => {
              const orderQty = watch(`size_checks.${index}.order_qty`);
              const packedQty = watch(`size_checks.${index}.packed_qty`);
              const diff = packedQty - orderQty;
              const dev = orderQty ? ((diff / orderQty) * 100).toFixed(1) : '0.0';
              const isHighDev = Math.abs(parseFloat(dev)) > 5;

              return (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <Input {...register(`size_checks.${index}.size` as const)} placeholder="e.g. M" className="h-9" />
                  </div>
                  <div className="col-span-3">
                    <Input type="number" {...register(`size_checks.${index}.order_qty` as const, { valueAsNumber: true })} className="h-9" />
                  </div>
                  <div className="col-span-3">
                    <Input type="number" {...register(`size_checks.${index}.packed_qty` as const, { valueAsNumber: true })} className="h-9" />
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className={`font-mono text-sm font-bold ${isHighDev ? 'text-red-600' : 'text-gray-600'}`}>
                      {dev}%
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeSize(index)}>
                      <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                    </Button>
                  </div>
                </div>
              );
            })}

            <Button type="button" variant="outline" size="sm" onClick={() => appendSize({ size: '', order_qty: 0, packed_qty: 0 })} className="mt-2 text-xs">
              <Plus className="h-3 w-3 mr-2" /> Add Size Row
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Measurement Chart (NEW) */}
      <Card>
        <CardHeader>
          <CardTitle>4. Measurement Chart</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedTemplateId && (
            <div className="text-center p-6 bg-gray-50 rounded border border-dashed text-gray-500">
              Please select a <strong>Template</strong> in General Information to load measurement points.
            </div>
          )}

          {selectedTemplateId && (
            <div className="overflow-x-auto">
              <div className="min-w-[800px] grid grid-cols-10 gap-2 mb-2 font-bold text-xs text-gray-600 uppercase text-center bg-gray-50 p-2 rounded">
                <div className="col-span-3 text-left pl-2">POM</div>
                <div className="col-span-1">Spec</div>
                <div className="col-span-1">Tol</div>
                <div className="col-span-1">S1</div>
                <div className="col-span-1">S2</div>
                <div className="col-span-1">S3</div>
                <div className="col-span-1">S4</div>
                <div className="col-span-1">S5</div>
              </div>

              {measurementFields.map((field, index) => {
                const currentPOM = measurements[index] || {};

                return (
                  <div key={field.id} className="min-w-[800px] grid grid-cols-10 gap-2 mb-2 items-center hover:bg-gray-50 p-1 rounded">
                    {/* Read-only POM Info */}
                    <div className="col-span-3">
                      <Input {...register(`measurements.${index}.pom_name`)} readOnly className="bg-transparent border-none shadow-none h-8 font-medium text-sm" />
                    </div>
                    <div className="col-span-1">
                      <Input {...register(`measurements.${index}.spec`)} readOnly className="bg-transparent border-none shadow-none h-8 text-center text-xs text-gray-500" />
                    </div>
                    <div className="col-span-1">
                      <Input {...register(`measurements.${index}.tol`)} readOnly className="bg-transparent border-none shadow-none h-8 text-center text-xs text-gray-500" />
                    </div>

                    {/* Measurement Inputs 1-5 */}
                    {[1, 2, 3, 4, 5].map((num) => {
                      const key = `s${num}` as 's1' | 's2' | 's3' | 's4' | 's5';
                      const val = currentPOM[key];
                      const isBad = isOutOfTolerance(val, currentPOM.spec, currentPOM.tol);

                      return (
                        <div key={num} className="col-span-1">
                          <Input
                            {...register(`measurements.${index}.${key}` as const)}
                            className={`h-8 text-center text-sm ${isBad ? 'bg-red-50 text-red-600 font-bold border-red-300' : ''}`}
                            placeholder="-"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Defect Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>5. Defect Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.keys(defectCounts).map(defect => (
            <div key={defect} className="flex items-center justify-between p-3 bg-white border rounded hover:shadow-sm transition-all">
              <span className="font-medium flex-1 text-gray-700">{defect}</span>
              <div className="flex gap-4">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-red-600 w-10 font-bold uppercase">Critical</span>
                  <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateDefectCount(defect, 'critical', -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center font-bold">{defectCounts[defect].critical}</span>
                  <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateDefectCount(defect, 'critical', 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <div className="w-px bg-gray-200 h-6 mx-1"></div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-orange-600 w-10 font-bold uppercase">Major</span>
                  <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateDefectCount(defect, 'major', -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center font-bold">{defectCounts[defect].major}</span>
                  <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateDefectCount(defect, 'major', 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <div className="w-px bg-gray-200 h-6 mx-1"></div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-600 w-10 font-bold uppercase">Minor</span>
                  <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateDefectCount(defect, 'minor', -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center font-bold">{defectCounts[defect].minor}</span>
                  <Button type="button" size="sm" variant="outline" className="h-6 w-6 p-0" onClick={() => updateDefectCount(defect, 'minor', 1)}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Input
              placeholder="Add custom defect type..."
              value={customDefect}
              onChange={(e) => setCustomDefect(e.target.value)}
            />
            <Button type="button" onClick={addCustomDefect} variant="secondary">Add</Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Shipment Details */}
      <Card>
        <CardHeader>
          <CardTitle>6. Shipment Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Label>Total Cartons</Label><Input type="number" {...register('total_cartons', { valueAsNumber: true })} className="mt-1" /></div>
          <div><Label>Selected Cartons</Label><Input type="number" {...register('selected_cartons', { valueAsNumber: true })} className="mt-1" /></div>
          <div><Label>Gross Weight (kg)</Label><Input type="number" step="0.1" {...register('gross_weight', { valueAsNumber: true })} className="mt-1" /></div>
          <div><Label>Net Weight (kg)</Label><Input type="number" step="0.1" {...register('net_weight', { valueAsNumber: true })} className="mt-1" /></div>
          <div className="col-span-1 md:col-span-2 grid grid-cols-3 gap-2">
            <div className="col-span-3 mb-1 text-sm font-medium">Carton Dimensions (cm)</div>
            <Input placeholder="L" type="number" step="0.1" {...register('carton_length', { valueAsNumber: true })} />
            <Input placeholder="W" type="number" step="0.1" {...register('carton_width', { valueAsNumber: true })} />
            <Input placeholder="H" type="number" step="0.1" {...register('carton_height', { valueAsNumber: true })} />
          </div>
        </CardContent>
      </Card>

      {/* Section 7: Photo Evidence */}
      <Card>
        <CardHeader>
          <CardTitle>7. Photo Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-gray-400" />
                <p className="text-sm text-gray-600 font-medium">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-400">JPG, PNG (Max 10MB)</p>
              </div>
            </div>

            {uploadedImages.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {uploadedImages.map((img, idx) => (
                  <div key={idx} className="flex gap-3 p-3 bg-white border rounded shadow-sm items-start">
                    <div className="h-24 w-24 bg-gray-100 rounded overflow-hidden flex-shrink-0 border">
                      <img src={URL.createObjectURL(img.file)} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500 font-mono truncate max-w-[150px]">{img.file.name}</span>
                        <span className="text-xs font-bold text-blue-600">{img.category}</span>
                      </div>

                      <select
                        value={img.category}
                        onChange={(e) => {
                          const newImages = [...uploadedImages];
                          newImages[idx].category = e.target.value;
                          setUploadedImages(newImages);
                        }}
                        className="w-full border rounded p-1 text-sm h-8 bg-white"
                      >
                        <option value="General">General / Packaging</option>
                        <option value="Labeling">Labeling / Marking</option>
                        <option value="Defect">Defect Evidence</option>
                        <option value="Measurement">Measurement</option>
                        <option value="On-Site Test">On-Site Test</option>
                      </select>

                      <Input
                        placeholder="Enter caption..."
                        value={img.caption}
                        onChange={(e) => {
                          const newImages = [...uploadedImages];
                          newImages[idx].caption = e.target.value;
                          setUploadedImages(newImages);
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newImages = [...uploadedImages];
                        newImages.splice(idx, 1);
                        setUploadedImages(newImages);
                      }}
                      className="self-center"
                    >
                      <Trash2 className="h-4 w-4 text-red-400 hover:text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 8: Remarks */}
      <Card>
        <CardHeader>
          <CardTitle>8. Final Remarks</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea {...register('remarks')} rows={4} placeholder="Overall conclusion, notes for supplier, or specific observations..." />
        </CardContent>
      </Card>

      {/* Submit Buttons */}
      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose} className="w-32">Cancel</Button>
        <Button type="submit" disabled={createMutation.isPending} className="w-48 bg-green-600 hover:bg-green-700">
          {createMutation.isPending ? 'Submitting Report...' : 'Submit Final Report'}
        </Button>
      </div>
    </form>
  );
}