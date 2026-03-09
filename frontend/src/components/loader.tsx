"use client";

import { LoaderIcon } from "lucide-react";
import { useEffect, useState } from "react";

export default function Loader() {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return (
            <div className="absolute top-0 left-0 z-9999 flex h-full w-full flex-col items-center justify-center gap-4 bg-background">
                <div className="animate-spin"><LoaderIcon className="size-7" /></div>
                Ładowanie...
            </div>
        );
    }
    return null;
}