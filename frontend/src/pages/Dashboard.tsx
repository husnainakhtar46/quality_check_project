import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import api from '../lib/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Dashboard = () => {
    const { data, isLoading } = useQuery({
        queryKey: ['dashboard'],
        queryFn: async () => {
            const res = await api.get('/dashboard/');
            return res.data;
        },
    });

    if (isLoading) return <div>Loading...</div>;

    const passFailData = [
        { name: 'Pass', value: data?.pass_count || 0, fill: '#22c55e' },
        { name: 'Fail', value: data?.fail_count || 0, fill: '#ef4444' },
    ];

    // 1. Stage Data
    const stageData = data?.inspections_by_stage?.map((item: any) => ({
        name: item.stage,
        value: item.count
    })) || [];

    // 2. Customer Data
    const customerData = data?.inspections_by_customer?.map((item: any) => ({
        name: item.customer__name || 'Unknown',
        value: item.count
    })) || [];

    // 3. Monthly Trend
    const trendData = data?.monthly_trend?.map((item: any) => ({
        name: new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        value: item.count
    })) || [];

    // 4. Decision Comparison
    // We need to merge internal and customer decisions or just show them side-by-side
    // Let's create a combined dataset if possible, or just two separate bars?
    // A simple way is to show counts of each decision type for Internal vs Customer
    // But the decision values might differ (e.g. "Accepted" vs "Accepted with Comments")
    // Let's just plot them as is.

    // Better approach for comparison: 
    // We can show a bar chart with "Internal Accepted", "Customer Accepted", etc.
    // Or just two simple bar charts side-by-side?
    // Let's try to combine them into categories: Accepted, Rejected, Other

    const processDecisions = (decisions: any[], key: string) => {
        const counts = { Accepted: 0, Rejected: 0, Other: 0 };
        decisions?.forEach((d: any) => {
            if (d[key] === 'Accepted') counts.Accepted += d.count;
            else if (d[key] === 'Rejected') counts.Rejected += d.count;
            else counts.Other += d.count;
        });
        return counts;
    };

    const internalCounts = processDecisions(data?.internal_decisions, 'decision');
    const customerCounts = processDecisions(data?.customer_decisions, 'customer_decision');

    const comparisonData = [
        { name: 'Accepted', Internal: internalCounts.Accepted, Customer: customerCounts.Accepted },
        { name: 'Rejected', Internal: internalCounts.Rejected, Customer: customerCounts.Rejected },
        { name: 'Other', Internal: internalCounts.Other, Customer: customerCounts.Other },
    ];

    return (
        <div className="space-y-4 md:space-y-6 pb-10">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Total Evaluations</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{data?.total_inspections}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Pass Rate</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">{data?.pass_rate}%</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Passed</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">{data?.pass_count}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Failed</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-600">{data?.fail_count}</div></CardContent>
                </Card>
            </div>

            {/* Row 2: Existing Charts */}
            <div className="grid grid-cols-1 gap-4 md:gap-6">
                <Card className="h-[350px]">
                    <CardHeader><CardTitle>Pass vs Fail</CardTitle></CardHeader>
                    <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={passFailData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Row 3: Stage & Customer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* 1. Stage Distribution */}
                <Card className="h-[400px]">
                    <CardHeader><CardTitle>Evaluations by Stage</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stageData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {stageData.map((_: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 2. Customer Volume */}
                <Card className="h-[400px]">
                    <CardHeader><CardTitle>Evaluations by Customer</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={customerData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Row 4: Trend & Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* 3. Monthly Trend */}
                <Card className="h-[400px]">
                    <CardHeader><CardTitle>Monthly Trend</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 4. Decision Comparison */}
                <Card className="h-[400px]">
                    <CardHeader><CardTitle>Internal vs Customer Decisions</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={comparisonData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="Internal" fill="#82ca9d" />
                                <Bar dataKey="Customer" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
