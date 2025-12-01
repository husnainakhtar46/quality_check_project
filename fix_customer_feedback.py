import os

file_path = r"c:\Users\husna\Music\Dapp\quality_check_project\frontend\src\pages\CustomerFeedback.tsx"

new_content = """import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { MessageSquare, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
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
} from '../components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';

type Inspection = {
    id: string;
    style: string;
    color: string;
    po_number: string;
    stage: string;
    decision: string;
    customer_decision: string;
    customer_feedback_comments: string;
    customer_feedback_date: string;
    created_at: string;
    created_by_username: string;
};

type FeedbackForm = {
    customer_decision: string;
    customer_feedback_comments: string;
};

const CustomerFeedback = () => {
    const queryClient = useQueryClient();
    const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const { register, handleSubmit, reset, setValue } = useForm<FeedbackForm>();

    const { data: inspectionsData, isLoading } = useQuery({
        queryKey: ['inspections-feedback'],
        queryFn: async () => {
            const res = await api.get('/inspections/');
            return res.data;
        },
    });

    const inspections = Array.isArray(inspectionsData) ? inspectionsData : inspectionsData?.results || [];

    const updateMutation = useMutation({
        mutationFn: async (data: FeedbackForm) => {
            if (!selectedInspection) return;
            const res = await api.patch(`/inspections/${selectedInspection.id}/`, data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspections-feedback'] });
            setIsOpen(false);
            setSelectedInspection(null);
            reset();
            toast.success('Feedback updated successfully');
        },
        onError: () => {
            toast.error('Failed to update feedback');
        },
    });

    const handleEdit = (inspection: Inspection) => {
        setSelectedInspection(inspection);
        setValue('customer_decision', inspection.customer_decision || '');
        setValue('customer_feedback_comments', inspection.customer_feedback_comments || '');
        setIsOpen(true);
    };

    const onSubmit = (data: FeedbackForm) => {
        updateMutation.mutate(data);
    };

    const getDecisionBadge = (decision: string) => {
        switch (decision) {
            case 'Accepted':
                return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Accepted</Badge>;
            case 'Rejected':
                return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
            case 'Revision Requested':
                return <Badge className="bg-orange-500"><AlertCircle className="w-3 h-3 mr-1" /> Revision</Badge>;
            case 'Accepted with Comments':
                return <Badge className="bg-blue-500"><MessageSquare className="w-3 h-3 mr-1" /> Comments</Badge>;
            case 'Held Internally':
                return <Badge className="bg-gray-500"><Clock className="w-3 h-3 mr-1" /> Held</Badge>;
            default:
                return <Badge variant="outline">Pending</Badge>;
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Customer Feedback</h1>
            </div>

            <div className="border rounded-lg bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Style</TableHead>
                            <TableHead>Color</TableHead>
                            <TableHead>Stage</TableHead>
                            <TableHead>QA Decision</TableHead>
                            <TableHead>Customer Decision</TableHead>
                            <TableHead>Feedback Date</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inspections.map((inspection: Inspection) => (
                            <TableRow key={inspection.id}>
                                <TableCell className="font-medium">{inspection.style}</TableCell>
                                <TableCell>{inspection.color}</TableCell>
                                <TableCell>{inspection.stage}</TableCell>
                                <TableCell>
                                    <Badge variant={inspection.decision === 'Accepted' ? 'default' : inspection.decision === 'Rejected' ? 'destructive' : 'secondary'}>
                                        {inspection.decision || 'Pending'}
                                    </Badge>
                                </TableCell>
                                <TableCell>{getDecisionBadge(inspection.customer_decision)}</TableCell>
                                <TableCell>
                                    {inspection.customer_feedback_date ? new Date(inspection.customer_feedback_date).toLocaleDateString() : '-'}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEdit(inspection)}
                                    >
                                        <MessageSquare className="w-4 h-4 mr-2" />
                                        Feedback
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isOpen} onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) setSelectedInspection(null);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Customer Feedback</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Customer Decision</Label>
                            <Select
                                onValueChange={(value) => setValue('customer_decision', value)}
                                defaultValue={selectedInspection?.customer_decision || ''}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select decision" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Accepted">Accepted</SelectItem>
                                    <SelectItem value="Rejected">Rejected</SelectItem>
                                    <SelectItem value="Revision Requested">Revision Requested</SelectItem>
                                    <SelectItem value="Accepted with Comments">Accepted with Comments</SelectItem>
                                    <SelectItem value="Held Internally">Held Internally</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Comments</Label>
                            <Textarea
                                {...register('customer_feedback_comments')}
                                placeholder="Enter detailed feedback..."
                                className="min-h-[100px]"
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                            Save Feedback
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CustomerFeedback;
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"Successfully updated {file_path}")
