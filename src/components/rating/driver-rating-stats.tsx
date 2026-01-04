"use client";

import { useEffect, useState } from "react";
import { Star, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { StarRatingDisplay } from "./star-rating-display";

interface RatingDistribution {
    stars: number;
    count: number;
    percentage: number;
}

interface MonthlyStats {
    month: string;
    avg_rating: number;
    total_ratings: number;
}

interface DriverRatingStatsProps {
    driverId: string;
    ratingAvg: number;
    ratingCount: number;
}

export function DriverRatingStats({
    driverId,
    ratingAvg,
    ratingCount,
}: DriverRatingStatsProps) {
    const [distribution, setDistribution] = useState<RatingDistribution[]>([]);
    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        loadStats();
    }, [driverId]);

    const loadStats = async () => {
        setLoading(true);
        try {
            // Get distribution
            const { data: distData } = await supabase.rpc(
                "get_driver_rating_distribution",
                { p_driver_id: driverId }
            );
            if (distData) setDistribution(distData);

            // Get monthly stats
            const { data: monthData } = await supabase.rpc(
                "get_driver_monthly_stats",
                { p_driver_id: driverId, p_months: 3 }
            );
            if (monthData) setMonthlyStats(monthData);
        } catch (err) {
            console.error("Error loading rating stats:", err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate trend
    const getTrend = () => {
        if (monthlyStats.length < 2) return null;
        const current = monthlyStats[0]?.avg_rating || 0;
        const previous = monthlyStats[1]?.avg_rating || 0;
        const diff = current - previous;

        if (Math.abs(diff) < 0.1) return { icon: Minus, color: "text-gray-500", text: "Estable" };
        if (diff > 0) return { icon: TrendingUp, color: "text-green-600", text: "Subiendo" };
        return { icon: TrendingDown, color: "text-red-600", text: "Bajando" };
    };

    const trend = getTrend();

    if (ratingCount === 0) {
        return (
            <Card>
                <CardContent className="p-6 text-center">
                    <Star className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-muted-foreground">
                        Aún no tienes calificaciones
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Completa viajes para recibir tu primera estrella
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    Tu Reputación
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Main Rating */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold">{ratingAvg.toFixed(1)}</span>
                            <span className="text-muted-foreground">/ 5</span>
                        </div>
                        <StarRatingDisplay rating={ratingAvg} showCount={false} size="lg" />
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-semibold">{ratingCount}</p>
                        <p className="text-sm text-muted-foreground">
                            {ratingCount === 1 ? "Calificación" : "Calificaciones"}
                        </p>
                    </div>
                </div>

                {/* Trend indicator */}
                {trend && (
                    <div className={`flex items-center gap-2 ${trend.color} bg-muted/50 rounded-lg p-2`}>
                        <trend.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{trend.text} este mes</span>
                    </div>
                )}

                {/* Distribution */}
                {distribution.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                        <p className="text-sm font-medium text-muted-foreground">Distribución</p>
                        {distribution.map(({ stars, count, percentage }) => (
                            <div key={stars} className="flex items-center gap-2">
                                <span className="w-4 text-sm font-medium">{stars}</span>
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-yellow-400 transition-all duration-500"
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                                <span className="w-8 text-xs text-muted-foreground text-right">
                                    {count}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
