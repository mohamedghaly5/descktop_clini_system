import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const ReadOnlyBanner = () => {
    const { data: systemStatus } = useQuery({
        queryKey: ['system-status'],
        queryFn: async () => {
            // @ts-ignore
            const status = await window.api.getSystemStatus();
            return status;
        },
        // Poll every 30 seconds to check if maintenance mode changed
        refetchInterval: 30000
    });

    if (!systemStatus?.isReadOnly) return null;

    return (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 animate-pulse" />
                <span className="font-bold text-sm md:text-base">
                    System is upgrading, read-only mode enabled. No changes can be saved.
                </span>
            </div>
        </div>
    );
};

export default ReadOnlyBanner;
