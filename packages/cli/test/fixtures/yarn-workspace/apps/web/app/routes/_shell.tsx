import { Outlet } from "react-router";
import { FeatureFlagProvider } from "../feature-flags";

// The signed-in shell: every page below it has a session and the flag client.
export default function Shell() {
    return (
        <FeatureFlagProvider>
            <nav aria-label="Main" />
            <Outlet />
        </FeatureFlagProvider>
    );
}
