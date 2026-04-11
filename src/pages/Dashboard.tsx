import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StatCard from "@/components/StatCard";
import { Users, Palette, FolderOpen, Ruler, UserPlus, FileText, ImagePlus, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { format, subMonths } from "date-fns";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CHART_COLORS = [
  "hsl(var(--accent))",
  "hsl(var(--primary))",
  "hsl(35, 30%, 60%)",
  "hsl(30, 25%, 45%)",
  "hsl(38, 40%, 55%)",
  "hsl(25, 20%, 50%)",
];

const Dashboard = () => {
  const { tenant } = useAuth();
  const [stats, setStats] = useState({ customers: 0, designs: 0, categories: 0, measurements: 0 });
  const [recentMeasurements, setRecentMeasurements] = useState<any[]>([]);
  const [measurementsByMonth, setMeasurementsByMonth] = useState<any[]>([]);
  const [designsByCategory, setDesignsByCategory] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [c, d, cat, m] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("designs").select("id", { count: "exact", head: true }),
        supabase.from("categories").select("id", { count: "exact", head: true }),
        supabase.from("measurements").select("id", { count: "exact", head: true }),
      ]);
      setStats({ customers: c.count ?? 0, designs: d.count ?? 0, categories: cat.count ?? 0, measurements: m.count ?? 0 });

      const { data: recent } = await supabase
        .from("measurements")
        .select("id, date_recorded, customer_id, customers(first_name, last_name)")
        .order("date_recorded", { ascending: false })
        .limit(5);
      setRecentMeasurements(recent ?? []);

      const { data: allMeasurements } = await supabase
        .from("measurements")
        .select("date_recorded")
        .gte("date_recorded", subMonths(new Date(), 5).toISOString())
        .order("date_recorded", { ascending: true });

      const monthMap: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        monthMap[format(d, "MMM yyyy")] = 0;
      }
      (allMeasurements ?? []).forEach((m) => {
        const key = format(new Date(m.date_recorded), "MMM yyyy");
        if (key in monthMap) monthMap[key]++;
      });
      setMeasurementsByMonth(Object.entries(monthMap).map(([month, count]) => ({ month, count })));

      const { data: designs } = await supabase
        .from("designs")
        .select("category_id, categories(name)");
      const catMap: Record<string, number> = {};
      (designs ?? []).forEach((d) => {
        const name = (d.categories as any)?.name ?? "Uncategorized";
        catMap[name] = (catMap[name] || 0) + 1;
      });
      setDesignsByCategory(Object.entries(catMap).map(([name, value]) => ({ name, value })));
    };
    load();
  }, []);

  const measurementsChartConfig = { count: { label: "Measurements", color: "hsl(var(--accent))" } };
  const designsChartConfig = designsByCategory.reduce((acc, item, i) => {
    acc[item.name] = { label: item.name, color: CHART_COLORS[i % CHART_COLORS.length] };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {tenant ? `Welcome, ${tenant.business_name}` : "Dashboard"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {tenant ? `Manage ${tenant.business_name}'s fashion business` : "Here's an overview of your fashion business"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TrendingUp className="w-3.5 h-3.5 text-accent" />
          <span>{format(new Date(), "EEEE, MMM d, yyyy")}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Customers" value={stats.customers} icon={Users} />
        <StatCard title="Total Designs" value={stats.designs} icon={Palette} />
        <StatCard title="Categories" value={stats.categories} icon={FolderOpen} />
        <StatCard title="Measurements" value={stats.measurements} icon={Ruler} />
      </div>

      {/* Quick Actions */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild size="sm" className="gap-2 rounded-lg">
            <Link to="/customers"><UserPlus className="w-3.5 h-3.5" /> Add Customer</Link>
          </Button>
          <Button asChild size="sm" variant="secondary" className="gap-2 rounded-lg">
            <Link to="/measurements"><FileText className="w-3.5 h-3.5" /> Add Measurement</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-2 rounded-lg">
            <Link to="/designs"><ImagePlus className="w-3.5 h-3.5" /> Add Design</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-base">Measurements Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {measurementsByMonth.length === 0 ? (
              <p className="text-muted-foreground text-sm">No data yet.</p>
            ) : (
              <ChartContainer config={measurementsChartConfig} className="h-[220px] w-full">
                <BarChart data={measurementsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="font-display text-base">Designs by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {designsByCategory.length === 0 ? (
              <p className="text-muted-foreground text-sm">No designs yet.</p>
            ) : (
              <ChartContainer config={designsChartConfig} className="h-[220px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie data={designsByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                    {designsByCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Overview table */}
      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle className="font-display text-base">Quick Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {recentMeasurements.length === 0 ? (
            <p className="text-muted-foreground text-sm">No measurements recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMeasurements.map((m) => (
                    <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 font-medium text-foreground">
                        {(m.customers as any)?.first_name} {(m.customers as any)?.last_name}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {format(new Date(m.date_recorded), "MMM d, yyyy")}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link to={`/customers/${m.customer_id}`} className="text-xs font-medium text-accent hover:text-accent/80 transition-colors">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
