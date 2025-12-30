import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export function RequestCardSkeleton() {
    return (
        <Card className="border-l-4 border-l-gray-200">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-24 mt-2" />
            </CardHeader>
            <CardContent className="pb-3 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-28" />
            </CardContent>
            <CardFooter>
                <Skeleton className="h-9 w-full" />
            </CardFooter>
        </Card>
    );
}

export function RequestCardSkeletonList({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-4">
            {Array.from({ length: count }).map((_, i) => (
                <RequestCardSkeleton key={i} />
            ))}
        </div>
    );
}
