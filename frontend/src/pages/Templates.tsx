import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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

type POM = {
    name: string;
    default_tol: number;
};

type TemplateForm = {
    name: string;
    description: string;
    poms: POM[];
};

const Templates = () => {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);

    const { register, control, handleSubmit, reset } = useForm<TemplateForm>({
        defaultValues: {
            poms: [{ name: '', default_tol: 0 }]
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "poms"
    });

    const { data: templates, isLoading } = useQuery({
        queryKey: ['templates'],
        queryFn: async () => {
            const res = await api.get('/templates/');
            return res.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: TemplateForm) => {
            const res = await api.post('/templates/', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
            setIsOpen(false);
            reset();
            toast.success('Template created');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/templates/${id}/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
            toast.success('Template deleted');
        },
    });

    const onSubmit = (data: TemplateForm) => {
        createMutation.mutate(data);
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Template
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create New Template</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
                            <div className="space-y-2">
                                <Label>Template Name</Label>
                                <Input {...register("name", { required: true })} placeholder="e.g. T-Shirt Basic" />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea {...register("description")} placeholder="Optional description" />
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <Label>Points of Measure (POM)</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', default_tol: 0 })}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add POM
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="flex gap-2 items-end">
                                            <div className="flex-1">
                                                <Label className="text-xs">POM Name</Label>
                                                <Input {...register(`poms.${index}.name` as const, { required: true })} placeholder="Chest Width" />
                                            </div>
                                            <div className="w-32">
                                                <Label className="text-xs">Tolerance (+/-)</Label>
                                                <Input type="number" step="0.1" {...register(`poms.${index}.default_tol` as const)} />
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                                Save Template
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>POM Count</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {templates?.map((template: any) => (
                            <TableRow key={template.id}>
                                <TableCell className="font-medium">{template.name}</TableCell>
                                <TableCell>{template.description}</TableCell>
                                <TableCell>{template.poms?.length || 0}</TableCell>
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-500 hover:text-red-700"
                                        onClick={() => {
                                            if (confirm('Are you sure?')) {
                                                deleteMutation.mutate(template.id);
                                            }
                                        }}
                                    >
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

export default Templates;
