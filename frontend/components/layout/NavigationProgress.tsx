'use client';

/**
 * NavigationProgress - tracks in-progress route transitions for App Router.
 *
 * Strategy:
 *  1. Monkey-patch window.history.pushState / replaceState — these are called
 *     by Next.js <Link> and router.push() BEFORE the new route renders.
 *  2. Listen for the Next.js internal "pathnameChange" by watching usePathname();
 *     when pathname actually changes the navigation is complete.
 */

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type NavCtx = { navigating: boolean };
const NavContext = createContext<NavCtx>({ navigating: false });

export function useNavigating() {
    return useContext(NavContext).navigating;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const prevPathname = useRef(pathname);
    const [navigating, setNavigating] = useState(false);

    // Patch history methods to detect navigation start
    useEffect(() => {
        const orig = {
            push: history.pushState.bind(history),
            replace: history.replaceState.bind(history),
        };

        const onStart = () => setNavigating(true);

        history.pushState = function (...args) {
            onStart();
            return orig.push(...args);
        };
        history.replaceState = function (...args) {
            orig.replace(...args);
        };

        return () => {
            history.pushState = orig.push;
            history.replaceState = orig.replace;
        };
    }, []);

    // When pathname actually changes → navigation complete
    useEffect(() => {
        if (pathname !== prevPathname.current) {
            prevPathname.current = pathname;
            setNavigating(false);
        }
    }, [pathname]);

    return (
        <NavContext.Provider value={{ navigating }}>
            {children}
        </NavContext.Provider>
    );
}
