import os
import shutil

# File path
file_path = r'c:\Users\husna\Music\Dapp\quality_check_project\frontend\src\pages\FinalInspections.tsx'
backup_path = file_path + '.backup'

# Create backup of corrupted file
if os.path.exists(file_path):
    shutil.copy(file_path, backup_path)
    print(f"✓ Backed up corrupted file to {backup_path}")

# Correct file content
correct_content = '''import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Download, Plus, Search, Eye, Trash2, FileText } from 'lucide-react';
import { useToast } from '../components/ui/use-toast';
import FinalInspectionForm from '../components/FinalInspectionForm';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface FinalInspection {
  id: string;
  order_no: string;
  style_no: string;
  color?: string;
  customer: string | null;
  customer_name?: string;
  inspection_date: string;
  result: 'Pass' | 'Fail' | 'Pending';
  total_order_qty: number;
  sample_size: number;
  created_at: string;
  created_by_username?: string;
}

export default function FinalInspections() {
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const token = localStorage.getItem('access_token');

  // Fetch final inspections
  const { data: inspections, isLoading } = useQuery<FinalInspection[]>({
    queryKey: ['finalInspections', resultFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (resultFilter) params.append('result', resultFilter);

      const response = await axios.get(`${API_URL}/final-inspections/?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`${API_URL}/final-inspections/${id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finalInspections'] });
      toast({ title: 'Final Inspection deleted successfully' });
    },
  });

  // Download PDF
  const handleDownloadPDF = async (inspection: FinalInspection) => {
    try {
      const response = await axios.get(
        `${API_URL}/final-inspections/${inspection.id}/pdf/`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `FIR_${inspection.order_no}_${inspection.style_no}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast({ title: 'PDF downloaded successfully' });
    } catch (error) {
      toast({ title: 'Failed to download PDF', variant: 'destructive' });
    }
  };

  // Filter inspections
  const filteredInspections = inspections?.filter((insp) =>
    insp.order_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    insp.style_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (insp.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'Pass':
        return <Badge className="bg-green-500">Pass</Badge>;
      case 'Fail':
        return <Badge variant="destructive">Fail</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-10">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Final Inspection Reports</h1>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create New FIR
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by order no, style, or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="border rounded-md px-3 py-2"
            >
              <option value="">All Results</option>
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card><CardContent className="pt-6">Loading...</CardContent></Card>
        ) : filteredInspections && filteredInspections.length > 0 ? (
          filteredInspections.map((inspection) => (
            <Card key={inspection.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{inspection.order_no}</h3>
                      {getResultBadge(inspection.result)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                      <div><span className="font-medium">Style:</span> {inspection.style_no}</div>
                      <div><span className="font-medium">Customer:</span> {inspection.customer_name || 'N/A'}</div>
                      <div><span className="font-medium">Date:</span> {new Date(inspection.inspection_date).toLocaleDateString()}</div>
                      <div><span className="font-medium">Order Qty:</span> {inspection.total_order_qty}</div>
                      <div><span className="font-medium">Sample Size:</span> {inspection.sample_size}</div>
                      <div><span className="font-medium">Created:</span> {new Date(inspection.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPDF(inspection)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedInspection(inspection.id);
                        setIsFormOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this Final Inspection?')) {
                          deleteMutation.mutate(inspection.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No final inspections found</p>
              <p className="text-sm">Create your first FIR to get started</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-full w-screen h-screen overflow-y-auto rounded-none p-0">
          <FinalInspectionForm
            inspectionId={selectedInspection || undefined}
            onClose={() => {
              setIsFormOpen(false);
              setSelectedInspection(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
'''

# Write the correct content
with open(file_path, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(correct_content)

print(f"✓ Successfully restored {os.path.basename(file_path)}")
print(f"✓ File is now fixed and ready to use")
print(f"\nChanges made:")
print("  - Restored complete file structure")
print("  - Fixed React Query cache settings (gcTime instead of cacheTime)")
print("  - Added responsive spacing (space-y-4 md:space-y-6 pb-10)")
