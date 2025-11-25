import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, FileText, Mail, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../components/ui/dialog';

// Type for our image slots
type ImageSlot = {
    file: File | null;
    caption: string;
};

const Inspections = () => {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

    // Manage 4 fixed image slots
    const [imageSlots, setImageSlots] = useState<ImageSlot[]>([
        { file: null, caption: '' },
        { file: null, caption: '' },
        { file: null, caption: '' },
        { file: null, caption: '' },
    ]);

    const { register, control, handleSubmit, reset, setValue, watch } = useForm({
        defaultValues: {
            style: '',
            color: '',
            po_number: '',
            stage: 'PPS',
            customer: '',
            template: '',
            remarks: '',
            decision: '', // Manual decision
            measurements: [] as any[],
        }
    });

    const { fields, replace } = useFieldArray({
        control,
        name: "measurements"
    });

    // Data Fetching
    const { data: inspections, isLoading } = useQuery({
        queryKey: ['inspections'],
        queryFn: async () => (await api.get('/inspections/')).data,
    });

    const { data: customers } = useQuery({
        queryKey: ['customers'],
        queryFn: async () => (await api.get('/customers/')).data,
    });

    const { data: templates } = useQuery({
        queryKey: ['templates'],
        queryFn: async () => (await api.get('/templates/')).data,
    });

    // Create Logic
    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            // 1. Create Inspection with Manual Decision
            const jsonPayload = {
                ...data,
                measurements: data.measurements.map((m: any) => ({
                    ...m,
                    s1: m.s1 === '' ? null : m.s1,
                    s2: m.s2 === '' ? null : m.s2,
                    s3: m.s3 === '' ? null : m.s3,
                }))
            };

            const res = await api.post('/inspections/', jsonPayload);
            const inspectionId = res.data.id;

            // 2. Upload Images Loop
            for (const slot of imageSlots) {
                if (slot.file) {
                    const formData = new FormData();
                    formData.append('image', slot.file);
                    formData.append('caption', slot.caption || 'Inspection Image');

                    await api.post(`/inspections/${inspectionId}/upload_image/`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }
            }
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
            setIsOpen(false);
            reset();
            setImageSlots([
                { file: null, caption: '' }, { file: null, caption: '' },
                { file: null, caption: '' }, { file: null, caption: '' }
            ]);
            setSelectedTemplate(null);
            toast.success('Inspection created successfully');
        },
        // FIXED: Added type 'any' to error parameter
        onError: (err: any) => {
            console.error(err);
            toast.error('Failed to create inspection');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => api.delete(`/inspections/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
            toast.success('Deleted');
        }
    });

    const emailMutation = useMutation({
        mutationFn: async ({ id, email }: { id: string; email: string }) => {
            await api.post(`/inspections/${id}/send_email/`, { recipients: [email] });
        },
        onSuccess: () => toast.success('Email sent')
    });

    // Watch template changes
    useEffect(() => {
        if (selectedTemplate && templates) {
            const template = templates.find((t: any) => t.id === selectedTemplate);
            if (template) {
                replace(template.poms.map((pom: any) => ({
                    pom_name: pom.name,
                    tol: pom.default_tol,
                    std: pom.default_std,
                    s1: '', s2: '', s3: '', status: 'OK'
                })));
            }
        }
    }, [selectedTemplate, templates, replace]);

    // Auto-calculate Status (Red Text in UI)
    const measurements = watch('measurements');
    useEffect(() => {
        measurements.forEach((m, index) => {
            if (m.std && (m.s1 || m.s2 || m.s3)) {
                const vals = [parseFloat(m.s1), parseFloat(m.s2), parseFloat(m.s3)].filter(v => !isNaN(v));
                if (vals.length > 0) {
                    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                    const diff = Math.abs(avg - m.std);
                    // Use tolerance + small epsilon for float comparison
                    const status = diff > (m.tol + 0.0001) ? 'FAIL' : 'OK';
                    if (m.status !== status) {
                        setValue(`measurements.${index}.status`, status);
                    }
                }
            }
        });
    }, [JSON.stringify(measurements), setValue]);

    // Helper to handle image slot changes
    const handleImageChange = (index: number, file: File | null) => {
        const newSlots = [...imageSlots];
        newSlots[index].file = file;
        // Auto-set caption if empty and file selected
        if (file && !newSlots[index].caption) {
            if (index === 0) newSlots[index].caption = "Front View";
            if (index === 1) newSlots[index].caption = "Back View";
        }
        setImageSlots(newSlots);
    };

    const handleCaptionChange = (index: number, text: string) => {
        const newSlots = [...imageSlots];
        newSlots[index].caption = text;
        setImageSlots(newSlots);
    };

    const handleDownloadPdf = async (id: string, style: string) => {
        try {
            const res = await api.get(`/inspections/${id}/pdf/`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${style}.pdf`);
            document.body.appendChild(link);
            link.click();
        } catch (e) { toast.error('Download failed'); }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Inspections</h1>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="w-4 h-4 mr-2" />New Inspection</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>New Inspection</DialogTitle></DialogHeader>

                        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-6 py-4">
                            {/* Top Form Grid */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Style</Label>
                                    <Input {...register("style", { required: true })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Color</Label>
                                    <Input {...register("color")} />
                                </div>
                                <div className="space-y-2">
                                    <Label>PO Number</Label>
                                    <Input {...register("po_number")} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Stage</Label>
                                    <Select onValueChange={(v) => setValue("stage", v)} defaultValue="PPS">
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Proto">Proto</SelectItem>
                                            <SelectItem value="PPS">PPS</SelectItem>
                                            <SelectItem value="Production">Production</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Customer</Label>
                                    <Select onValueChange={(v) => setValue("customer", v)}>
                                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                        <SelectContent>
                                            {customers?.map((c: any) => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Template</Label>
                                    <Select onValueChange={(v) => { setValue("template", v); setSelectedTemplate(v); }}>
                                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                        <SelectContent>
                                            {templates?.map((t: any) => (
                                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Measurements Table */}
                            <div className="space-y-2">
                                <Label>Measurements</Label>
                                <div className="border rounded-md p-4 bg-white">
                                    <div className="grid grid-cols-11 gap-2 mb-2 font-medium text-xs text-gray-500 uppercase">
                                        <div className="col-span-3">POM</div>
                                        <div className="col-span-1">Tol</div>
                                        <div className="col-span-1">Std</div>
                                        <div className="col-span-2">S1</div>
                                        <div className="col-span-2">S2</div>
                                        <div className="col-span-2">S3</div>
                                    </div>
                                    {fields.map((field, index) => {
                                        const m = measurements[index] || {};
                                        const checkTol = (val: any) => {
                                            if (!val || val === '' || !m.std) return false;
                                            return Math.abs(parseFloat(val) - parseFloat(m.std)) > parseFloat(m.tol);
                                        };

                                        return (
                                            <div key={field.id} className="grid grid-cols-11 gap-2 mb-2 items-center">
                                                <div className="col-span-3"><Input {...register(`measurements.${index}.pom_name`)} readOnly className="bg-gray-50 h-8 text-xs" /></div>
                                                <div className="col-span-1"><Input {...register(`measurements.${index}.tol`)} readOnly className="bg-gray-50 h-8 text-xs" /></div>
                                                <div className="col-span-1"><Input {...register(`measurements.${index}.std`)} readOnly className="bg-gray-50 h-8 text-xs" /></div>
                                                <div className="col-span-2">
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        {...register(`measurements.${index}.s1`)}
                                                        className={`h-8 ${checkTol(m.s1) ? 'text-red-600 font-bold' : ''}`}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        {...register(`measurements.${index}.s2`)}
                                                        className={`h-8 ${checkTol(m.s2) ? 'text-red-600 font-bold' : ''}`}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        {...register(`measurements.${index}.s3`)}
                                                        className={`h-8 ${checkTol(m.s3) ? 'text-red-600 font-bold' : ''}`}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 4 Pictures Upload Section */}
                            <div className="space-y-2">
                                <Label>Inspection Images (Max 4)</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    {imageSlots.map((slot, idx) => (
                                        <div key={idx} className="border p-3 rounded-md space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded">#{idx + 1}</span>
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    className="text-xs"
                                                    onChange={(e) => handleImageChange(idx, e.target.files ? e.target.files[0] : null)}
                                                />
                                            </div>
                                            <Input
                                                placeholder="Enter Caption (e.g., Front, Defect)"
                                                value={slot.caption}
                                                onChange={(e) => handleCaptionChange(idx, e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Remarks</Label>
                                    <Textarea {...register("remarks")} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Overall Decision</Label>
                                    <Select onValueChange={(v) => setValue("decision", v)} required>
                                        <SelectTrigger className="h-20 text-lg font-bold">
                                            <SelectValue placeholder="Select Result..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Approved" className="text-green-600 font-bold">Approved</SelectItem>
                                            <SelectItem value="Rejected" className="text-red-600 font-bold">Rejected</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Button type="submit" className="w-full h-12 text-lg" disabled={createMutation.isPending}>
                                {createMutation.isPending ? 'Submitting...' : 'Save & Generate Report'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* List Table */}
            <div className="border rounded-lg bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Style</TableHead>
                            <TableHead>Stage</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Decision</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inspections?.map((inspection: any) => (
                            <TableRow key={inspection.id}>
                                <TableCell className="font-medium">{inspection.style}</TableCell>
                                <TableCell>{inspection.stage}</TableCell>
                                <TableCell>{new Date(inspection.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${inspection.decision === 'Approved' ? 'bg-green-100 text-green-800' :
                                        inspection.decision === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-gray-100'
                                        }`}>
                                        {inspection.decision || 'Pending'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(inspection.id, inspection.style)}>
                                        <FileText className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const email = prompt('Enter recipient email:');
                                        if (email) emailMutation.mutate({ id: inspection.id, email });
                                    }}>
                                        <Mail className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(inspection.id) }}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default Inspections;