import { Outlet } from "react-router";
import { useEffect } from "react";
import { QueryProvider } from "./query-provider";

// Theme and boot signal, as a real root does.
export default function Root() {
    useEffect(() => {
        document.documentElement.dataset.theme = "light";
    }, []);

    return (
        <QueryProvider>
            <Outlet />
        </QueryProvider>
    );
}
