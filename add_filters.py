import os

file_path = r'c:\Users\husna\Music\Dapp\quality_check_project\frontend\src\pages\CustomerFeedback.tsx'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Add Import
import_statement = "import InspectionFilters from '../components/InspectionFilters';"
if import_statement not in content:
    content = content.replace(
        "import { Badge } from '../components/ui/badge';",
        "import { Badge } from '../components/ui/badge';\n" + import_statement
    )

# 2. Add State
state_logic = """
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        decisions: [] as string[],
        stages: [] as string[],
        customer: '',
        search: '',
        ordering: '-created_at',
    });
"""
if "const [filters, setFilters]" not in content:
    content = content.replace(
        "const [isOpen, setIsOpen] = useState(false);",
        "const [isOpen, setIsOpen] = useState(false);\n" + state_logic
    )

# 3. Replace useQuery
old_query = """    const { data: inspectionsData, isLoading } = useQuery({
        queryKey: ['inspections-feedback'],
        queryFn: async () => {
            const res = await api.get('/inspections/');
            return res.data;
        },
    });"""

new_query = """    const { data: inspectionsData, isLoading } = useQuery({
        queryKey: ['inspections-feedback', page, filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            if (filters.dateFrom) params.append('created_at_after', filters.dateFrom);
            if (filters.dateTo) params.append('created_at_before', filters.dateTo);
            if (filters.decisions.length > 0) filters.decisions.forEach(d => params.append('decision', d));
            if (filters.stages.length > 0) filters.stages.forEach(s => params.append('stage', s));
            if (filters.customer) params.append('customer', filters.customer);
            if (filters.search) params.append('search', filters.search);
            if (filters.ordering) params.append('ordering', filters.ordering);

            const res = await api.get(`/inspections/?${params.toString()}`);
            return res.data;
        },
    });"""

# We need to be careful with exact string matching. 
# If the file content varies slightly (e.g. whitespace), replace might fail.
# Let's try to locate the block more loosely if exact match fails, but for now exact match based on previous read.
if old_query in content:
    content = content.replace(old_query, new_query)
else:
    print("Warning: Could not find exact useQuery block to replace.")

# 4. Add Handlers
handlers = """
    const handleFiltersChange = (newFilters: typeof filters) => {
        setFilters(newFilters);
        setPage(1);
    };

    const handleClearFilters = () => {
        setFilters({
            dateFrom: '',
            dateTo: '',
            decisions: [] as string[],
            stages: [] as string[],
            customer: '',
            search: '',
            ordering: '-created_at',
        });
        setPage(1);
    };
"""
if "const handleFiltersChange" not in content:
    content = content.replace(
        "const handleEdit = (inspection: Inspection) => {",
        handlers + "\n    const handleEdit = (inspection: Inspection) => {"
    )

# 5. Add JSX
jsx_code = """
            <InspectionFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onClearAll={handleClearFilters}
            />
"""
if "<InspectionFilters" not in content:
    content = content.replace(
        '<div className="border rounded-lg bg-white shadow-sm">',
        jsx_code + '\n            <div className="border rounded-lg bg-white shadow-sm">'
    )

with open(file_path, 'w') as f:
    f.write(content)

print("Successfully updated CustomerFeedback.tsx")
