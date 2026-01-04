"use client";

import { Star } from "lucide-react";

interface StarRatingDisplayProps {
    rating: number;
    count?: number;
    size?: "sm" | "md" | "lg";
    showCount?: boolean;
}

export function StarRatingDisplay({
    rating,
    count,
    size = "md",
    showCount = true,
}: StarRatingDisplayProps) {
    const sizeClasses = {
        sm: "h-3 w-3",
        md: "h-4 w-4",
        lg: "h-5 w-5",
    };

    const textSizeClasses = {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
    };

    const starSize = sizeClasses[size];
    const textSize = textSizeClasses[size];

    // Render 5 stars with partial fill based on rating
    return (
        <div className="flex items-center gap-1">
            <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => {
                    const fillPercentage = Math.min(100, Math.max(0, (rating - (star - 1)) * 100));

                    return (
                        <div key={star} className="relative">
                            {/* Background star (empty) */}
                            <Star className={`${starSize} text-gray-300`} />

                            {/* Foreground star (filled) with clip */}
                            <div
                                className="absolute inset-0 overflow-hidden"
                                style={{ width: `${fillPercentage}%` }}
                            >
                                <Star className={`${starSize} fill-yellow-400 text-yellow-400`} />
                            </div>
                        </div>
                    );
                })}
            </div>

            <span className={`font-semibold ${textSize}`}>
                {rating.toFixed(1)}
            </span>

            {showCount && count !== undefined && (
                <span className={`text-muted-foreground ${textSize}`}>
                    ({count})
                </span>
            )}
        </div>
    );
}
