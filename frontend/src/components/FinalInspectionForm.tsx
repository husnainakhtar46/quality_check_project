import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';
import { Plus, Minus, Trash2, Upload, AlertCircle } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { COMMON_DEFECTS } from '../lib/aqlCalculations';

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
  customer: string;
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
  s6: string;
  size_name: string;
  size_field_id?: string;
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
  inspection_attempt: '1st' | '2nd' | '3rd';
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
  // --- Grid Selection & Paste State ---
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragStart, setDragStart] = useState<{ r: number, c: number } | null>(null);
  const columnKeys = ['spec', 's1', 's2', 's3', 's4', 's5', 's6'];
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);


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

  const { register, control, handleSubmit, watch, setValue, getValues } = useForm<FormData>({
    defaultValues: {
      inspection_date: new Date().toISOString().split('T')[0],
      inspection_attempt: '1st',
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
  const sizeChecks = watch('size_checks');

  // --- Effects ---

  // 1. Auto-calculate sample size based on PRESENTED QTY
  // Removed client-side calculation effect as it's now handled by performCalculation

  // 2. Sync Measurement Chart with Size Checks & Template
  useEffect(() => {
    if (!selectedTemplateId || !templates) return;

    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    // Current measurements
    const currentMeasurements = getValues('measurements') || [];
    const newMeasurements: MeasurementInput[] = [];
    let hasChanges = false;

    // We iterate over the STABLE fields from useFieldArray
    sizeFields.forEach((field, idx) => {
      const sizeCheck = (sizeChecks || [])[idx];
      const sizeName = sizeCheck && sizeCheck.size ? sizeCheck.size.trim() : `Size ${idx + 1}`;
      const fieldId = field.id; // Stable ID from RHF

      // 1. Try to find measurements linked by ID
      let linkedMeasurements = currentMeasurements.filter(m => m.size_field_id === fieldId);

      // 2. If none, try to find by Name (legacy/initial load) and "claim" them
      if (linkedMeasurements.length === 0) {
        linkedMeasurements = currentMeasurements.filter(m => !m.size_field_id && m.size_name === sizeName);
        if (linkedMeasurements.length > 0) {
          // We found them by name, now we link them by ID for future stability
          linkedMeasurements = linkedMeasurements.map(m => ({ ...m, size_field_id: fieldId }));
          hasChanges = true;
        }
      }

      // 3. If still none, create new ones
      if (linkedMeasurements.length === 0) {
        template.poms.forEach(pom => {
          newMeasurements.push({
            pom_name: pom.name,
            spec: pom.default_std,
            tol: pom.default_tol,
            size_name: sizeName,
            size_field_id: fieldId, // Link by ID
            s1: '', s2: '', s3: '', s4: '', s5: '', s6: ''
          });
        });
        hasChanges = true;
      } else {
        // We have existing measurements, ensure they are in the new list
        // Also ensure size_name is up to date (in case of rename)
        linkedMeasurements.forEach(m => {
          if (m.size_name !== sizeName) {
            newMeasurements.push({ ...m, size_name: sizeName });
            hasChanges = true;
          } else {
            newMeasurements.push(m);
          }
        });
      }
    });

    // Check if we have any orphaned measurements (rows deleted)
    // The newMeasurements array only contains measurements for currently active fields.
    // If currentMeasurements has more items than we collected (excluding the ones we just created), it means some were removed.
    // But we can just compare length or content.

    // If we haven't detected changes yet, check if total count matches
    if (!hasChanges) {
      if (currentMeasurements.length !== newMeasurements.length) {
        hasChanges = true;
      }
    }

    if (hasChanges) {
      replaceMeasurements(newMeasurements);
    }
  }, [selectedTemplateId, templates, sizeChecks, sizeFields, replaceMeasurements, getValues]);

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

  const { critical, major, minor } = getTotalDefects();

  // State for Server-Side Calculations
  const [serverCalcs, setServerCalcs] = useState({
    sampleSize: 0,
    maxCritical: 0,
    maxMajor: 0,
    maxMinor: 0,
    result: 'Pending'
  });

  // --- API Calculation Hook ---
  const performCalculation = useCallback(async () => {
    if (!presentedQty) return;

    try {
      const response = await axios.post(
        `${API_URL}/final-inspections/calculate_aql/`,
        {
          qty: presentedQty,
          standard: aqlStandard,
          critical: critical,
          major: major,
          minor: minor
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = response.data;

      // Update Local State with Server Data
      setServerCalcs({
        sampleSize: data.sample_size,
        maxCritical: data.limits.critical,
        maxMajor: data.limits.major,
        maxMinor: data.limits.minor,
        result: data.result
      });

      // Update Form Field
      setValue('sample_size', data.sample_size);

    } catch (error) {
      console.error("Calculation failed", error);
    }
  }, [presentedQty, aqlStandard, critical, major, minor, token, setValue]);

  // --- Trigger Calculation ---
  // Debounce to avoid spamming server while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      performCalculation();
    }, 500); // Wait 500ms after typing stops
    return () => clearTimeout(timer);
  }, [performCalculation]);

  // Helper to check tolerance
  const isOutOfTolerance = (value: string, spec: number, tol: number) => {
    if (!value || value === '') return false;
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return false;
    return Math.abs(numVal - spec) > tol;
  };


  // --- Grid Helpers ---
  const getCellId = (r: number, k: string) => `${r}-${k}`;
  const isSelected = (index: number, key: string) => selectedCells.has(getCellId(index, key));

  // Handle KeyDown (Enter for Navigation, Backspace/Delete for Bulk Clear)
  const handleCellKeyDown = (e: React.KeyboardEvent, index: number, key: string) => {
    // Handle Enter for Navigation
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentColIdx = columnKeys.indexOf(key);
      if (currentColIdx === -1) return;

      // Try moving down (same column, next row)
      const nextRowIdx = index + 1;
      if (nextRowIdx < measurementFields.length) {
        const nextInput = document.querySelector(`input[name="measurements.${nextRowIdx}.${key}"]`) as HTMLInputElement;
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      } else {
        // If at bottom, move to top of next column
        const nextColIdx = currentColIdx + 1;
        if (nextColIdx < columnKeys.length) {
          const nextColKey = columnKeys[nextColIdx];
          const nextInput = document.querySelector(`input[name="measurements.0.${nextColKey}"]`) as HTMLInputElement;
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        }
      }
      return;
    }

    // If Backspace/Delete is pressed
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (selectedCells.size > 0) {
        if (selectedCells.has(getCellId(index, key)) || selectedCells.size > 0) {
          e.preventDefault();
          let count = 0;
          selectedCells.forEach(cellId => {
            const [rStr, k] = cellId.split('-');
            const r = parseInt(rStr);
            // We need to use setValue from useForm
            setValue(`measurements.${r}.${k}` as any, '');
            count++;
          });
          if (count > 0) {
            toast({ title: `Cleared ${count} cells` });
          }
        }
      }
    }
  };

  // Mouse Down (Start Drag)
  const handleCellMouseDown = (index: number, key: string) => {
    const cIndex = columnKeys.indexOf(key);
    if (cIndex === -1) return;

    setIsDragSelecting(true);
    setDragStart({ r: index, c: cIndex });
    setSelectedCells(new Set([getCellId(index, key)]));
  };

  // Mouse Enter (Drag Over)
  const handleCellMouseEnter = (index: number, key: string) => {
    if (isDragSelecting && dragStart) {
      const cIndex = columnKeys.indexOf(key);
      if (cIndex === -1) return;

      const rMin = Math.min(dragStart.r, index);
      const rMax = Math.max(dragStart.r, index);
      const cMin = Math.min(dragStart.c, cIndex);
      const cMax = Math.max(dragStart.c, cIndex);

      const newSet = new Set<string>();
      for (let r = rMin; r <= rMax; r++) {
        for (let c = cMin; c <= cMax; c++) {
          newSet.add(getCellId(r, columnKeys[c]));
        }
      }
      setSelectedCells(newSet);
    }
  };

  // Global Mouse Up (End Drag)
  useEffect(() => {
    const handleUp = () => {
      setIsDragSelecting(false);
      setDragStart(null);
    };
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, []);

  // Mobile: Long Press Logic
  const handleTouchStart = (index: number, key: string) => {
    longPressTimer.current = setTimeout(() => {
      const id = getCellId(index, key);
      setSelectedCells(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
      });
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  // Paste Handler
  const handleMeasurementPaste = (rowIndex: number, startColumn: string) => (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedData = event.clipboardData.getData('text');
    const lines = pastedData.split('\n').filter(line => line.trim());
    const firstLineColumns = lines[0]?.split('\t') || [];

    if (lines.length > 1 || firstLineColumns.length > 1) {
      event.preventDefault();
      // We need to get current measurements from form state
      // Since we are inside the component, we can use getValues if available or watch
      // But watch('measurements') is already available as `measurements`

      const startColIndex = columnKeys.indexOf(startColumn);
      if (startColIndex === -1) return;

      const hasHeader = /pom|name|std|spec|s1|s2|s3|s4|s5|s6/i.test(lines[0]);
      const dataRows = hasHeader ? lines.slice(1) : lines;
      const affectedRows = Math.min(dataRows.length, measurementFields.length - rowIndex);

      if (!confirm(`Paste ${dataRows.length} row(s) starting from ${startColumn.toUpperCase()} at row ${rowIndex + 1}?`)) {
        return;
      }

      dataRows.forEach((line, rowOffset) => {
        const targetRow = rowIndex + rowOffset;
        if (targetRow < measurementFields.length) {
          const columns = line.split('\t');
          columns.forEach((value, colOffset) => {
            const targetColIndex = startColIndex + colOffset;
            if (targetColIndex < columnKeys.length) {
              const fieldName = columnKeys[targetColIndex];
              setValue(`measurements.${targetRow}.${fieldName}` as any, value?.trim() || '');
            }
          });
        }
      });
      toast({ title: `Pasted ${affectedRows} rows` });
    }
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

      // Clean up measurements
      const measurements = data.measurements.map(m => ({
        ...m,
        spec: isNaN(Number(m.spec)) ? 0 : Number(m.spec),
        s1: m.s1 || '', s2: m.s2 || '', s3: m.s3 || '',
        s4: m.s4 || '', s5: m.s5 || '', s6: m.s6 || ''
      }));

      const payload = { ...data, defects, measurements };

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
    if (confirm('Are you confirmed to Submit?')) {
      createMutation.mutate(data);
    }
  };

  // Prevent Enter key from submitting/closing, except in textareas
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
      e.preventDefault();
    }
  };

  const handleCancel = () => {
    if (confirm('Are you confirmed to cancel?')) {
      onClose();
    }
  };

  return (
    <form onKeyDown={handleKeyDown} onSubmit={handleSubmit(onSubmit)} className="space-y-6 w-full max-w-6xl mx-auto pb-20 px-4 md:px-6 lg:px-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-4 mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">{inspectionId ? 'Edit Final Inspection' : 'New Final Inspection'}</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
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
              {templates?.filter(t => !watch('customer') || t.customer === watch('customer')).map((t: Template) => <option key={t.id} value={t.id}>{t.name}</option>)}
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
          <div>
            <Label>Inspection Attempt</Label>
            <select {...register('inspection_attempt')} className="w-full border rounded p-2 mt-1">
              <option value="1st">1st Inspection</option>
              <option value="2nd">2nd Inspection</option>
              <option value="3rd">3rd Inspection</option>
            </select>
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
          <CardTitle>2. AQL Result (Server Verified)</CardTitle>
          <Badge
            className={serverCalcs.result === 'Pass' ? 'bg-green-600' : 'bg-red-600'}
            style={{ fontSize: '1.2rem', padding: '0.5rem 1.5rem' }}
          >
            {serverCalcs.result.toUpperCase()}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Critical Card */}
            <div className={`p-4 rounded-lg border-2 transition-all ${critical > serverCalcs.maxCritical ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-gray-700">Critical</span>
                <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">Max: {serverCalcs.maxCritical}</span>
              </div>
              <div className="text-4xl font-bold text-gray-900">{critical}</div>
              <p className={`text-xs mt-1 font-bold ${critical > serverCalcs.maxCritical ? 'text-red-600' : 'text-green-600'}`}>
                {critical > serverCalcs.maxCritical ? 'FAILED' : 'WITHIN LIMIT'}
              </p>
            </div>

            {/* Major Card */}
            <div className={`p-4 rounded-lg border-2 transition-all ${major > serverCalcs.maxMajor ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-gray-700">Major</span>
                <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">Max: {serverCalcs.maxMajor}</span>
              </div>
              <div className="text-4xl font-bold text-gray-900">{major}</div>
              <p className={`text-xs mt-1 font-bold ${major > serverCalcs.maxMajor ? 'text-red-600' : 'text-green-600'}`}>
                {major > serverCalcs.maxMajor ? 'FAILED' : 'WITHIN LIMIT'}
              </p>
            </div>

            {/* Minor Card */}
            <div className={`p-4 rounded-lg border-2 transition-all ${minor > serverCalcs.maxMinor ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-gray-700">Minor</span>
                <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">Max: {serverCalcs.maxMinor}</span>
              </div>
              <div className="text-4xl font-bold text-gray-900">{minor}</div>
              <p className={`text-xs mt-1 font-bold ${minor > serverCalcs.maxMinor ? 'text-red-600' : 'text-green-600'}`}>
                {minor > serverCalcs.maxMinor ? 'FAILED' : 'WITHIN LIMIT'}
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
          <div className="space-y-2 overflow-x-auto">
            <div className="grid grid-cols-12 gap-2 font-semibold text-xs uppercase text-gray-500 mb-1 min-w-[600px]">
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
                <div key={field.id} className="grid grid-cols-12 gap-2 items-center min-w-[600px]">
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

      {/* Section 4: Measurement Chart (Size-Based) */}
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
            <Accordion type="multiple" className="w-full" defaultValue={sizeFields.map((_, i) => `item-${i}`)}>
              {sizeFields.map((field, sizeIndex) => {
                const sc = (sizeChecks || [])[sizeIndex];
                const sizeName = sc && sc.size ? sc.size : `Size ${sizeIndex + 1}`;
                // Filter measurements for this size
                // We need to find the indices in the main `measurementFields` array that correspond to this size.
                // Since we sync them in order, they should be grouped.
                // But `map` inside `map` is tricky with `register`.
                // We can filter `measurementFields` but we need the original `index` for `register`.

                const sizeMeasurements = measurementFields.map((field, index) => ({ field, index }))
                  .filter(({ index }) => measurements[index]?.size_field_id === field.id);

                if (sizeMeasurements.length === 0) return null;

                return (
                  <AccordionItem key={sizeIndex} value={`item-${sizeIndex}`}>
                    <AccordionTrigger className="bg-gray-50 px-4 rounded-t-md hover:no-underline hover:bg-gray-100">
                      <span className="font-bold text-lg text-blue-800">{sizeName}</span>
                    </AccordionTrigger>
                    <AccordionContent className="p-2 border rounded-b-md border-t-0">
                      <div className="overflow-x-auto">
                        <div className="min-w-[900px] grid grid-cols-11 gap-2 mb-2 font-bold text-xs text-gray-600 uppercase text-center bg-gray-50 p-2 rounded">
                          <div className="col-span-2 text-left pl-2">POM</div>
                          <div className="col-span-1">Tol</div>
                          <div className="col-span-1">Std</div>
                          <div className="col-span-1">S1</div>
                          <div className="col-span-1">S2</div>
                          <div className="col-span-1">S3</div>
                          <div className="col-span-1">S4</div>
                          <div className="col-span-1">S5</div>
                          <div className="col-span-1">S6</div>
                        </div>

                        {sizeMeasurements.map(({ field, index }) => {
                          const currentPOM = measurements[index] || {};

                          return (
                            <div key={field.id} className="min-w-[900px] grid grid-cols-11 gap-2 mb-2 items-center hover:bg-gray-50 p-1 rounded">
                              {/* Read-only POM Info */}
                              <div className="col-span-2">
                                <Input {...register(`measurements.${index}.pom_name`)} readOnly className="bg-transparent border-none shadow-none h-8 font-medium text-sm" />
                              </div>
                              <div className="col-span-1">
                                <Input {...register(`measurements.${index}.tol`)} readOnly className="bg-transparent border-none shadow-none h-8 text-center text-xs text-gray-500" />
                              </div>
                              <div className="col-span-1">
                                <Input
                                  {...register(`measurements.${index}.spec`)}
                                  className={`h-8 text-center text-sm ${isSelected(index, 'spec') ? 'bg-blue-200 ring-2 ring-blue-500 z-10 relative' : ''}`}
                                  onPaste={handleMeasurementPaste(index, 'spec')}
                                  onKeyDown={(e) => handleCellKeyDown(e, index, 'spec')}
                                  onMouseDown={() => handleCellMouseDown(index, 'spec')}
                                  onMouseEnter={() => handleCellMouseEnter(index, 'spec')}
                                  onTouchStart={() => handleTouchStart(index, 'spec')}
                                  onTouchEnd={handleTouchEnd}
                                  autoComplete="off"
                                />
                              </div>

                              {/* Measurement Inputs 1-6 */}
                              {[1, 2, 3, 4, 5, 6].map((num) => {
                                const key = `s${num}` as 's1' | 's2' | 's3' | 's4' | 's5' | 's6';
                                const val = currentPOM[key];
                                const isBad = isOutOfTolerance(val, currentPOM.spec, currentPOM.tol);

                                return (
                                  <div key={num} className="col-span-1">
                                    <Input
                                      {...register(`measurements.${index}.${key}` as const)}
                                      className={`h-8 text-center text-sm 
                                        ${isSelected(index, key) ? 'bg-blue-200 ring-2 ring-blue-500 z-10 relative' : ''} 
                                        ${!isSelected(index, key) && isBad ? 'bg-red-50 text-red-600 font-bold border-red-300' : ''}
                                      `}
                                      placeholder="-"
                                      onPaste={handleMeasurementPaste(index, key)}
                                      onKeyDown={(e) => handleCellKeyDown(e, index, key)}
                                      onMouseDown={() => handleCellMouseDown(index, key)}
                                      onMouseEnter={() => handleCellMouseEnter(index, key)}
                                      onTouchStart={() => handleTouchStart(index, key)}
                                      onTouchEnd={handleTouchEnd}
                                      autoComplete="off"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
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
            <div key={defect} className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 bg-white border rounded hover:shadow-sm transition-all">
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
                capture="environment"
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
        <Button type="button" variant="outline" onClick={handleCancel} className="w-32">Cancel</Button>
        <Button type="submit" disabled={createMutation.isPending} className="w-48 bg-green-600 hover:bg-green-700">
          {createMutation.isPending ? 'Submitting Report...' : 'Submit Report'}
        </Button>
      </div>
    </form>
  );
}