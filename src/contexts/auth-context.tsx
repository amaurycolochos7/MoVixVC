"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    role: string;
    avatar_url: string | null;
    kyc_status: string;
    is_available: boolean;
    // Rating fields
    rating_avg: number;
    rating_count: number;
    rating_sum: number;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId: string, authUser?: User) => {
        try {
            // Use maybeSingle to avoid error when no profile exists
            const { data, error } = await supabase
                .from("users")
                .select("*")
                .eq("id", userId)
                .maybeSingle();

            if (error) {
                console.error("[AuthContext] Error fetching profile:", error);
                return;
            }

            // Profile exists - use it
            if (data) {
                setProfile(data as UserProfile);
                return;
            }

            // No profile exists - create it
            console.log("[AuthContext] No profile found, creating...");

            const userToUse = authUser || user;
            const metadata = userToUse?.user_metadata || {};

            const { data: newProfile, error: insertError } = await supabase
                .from("users")
                .upsert({
                    id: userId,
                    email: userToUse?.email || '',
                    full_name: metadata.full_name || userToUse?.email?.split('@')[0] || 'Usuario',
                    phone: metadata.phone || null,
                    role: metadata.role || 'cliente',
                    kyc_status: metadata.role === 'cliente' ? 'approved' : 'pending',
                    is_available: false,
                    is_active: true,
                }, { onConflict: 'id' })
                .select()
                .single();

            if (insertError) {
                console.error("[AuthContext] Error creating profile:", insertError);
                return;
            }

            if (newProfile) {
                console.log("[AuthContext] Profile created successfully!");
                setProfile(newProfile as UserProfile);
            }
        } catch (err) {
            console.error("[AuthContext] Exception in fetchProfile:", err);
        }
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    };

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                // Non-blocking profile fetch - pass user for auto-create
                fetchProfile(session.user.id, session.user).catch(console.error);
            }
            setLoading(false);
        }).catch(err => {
            console.error("getSession error:", err);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                console.log("Auth state changed:", event);
                setUser(session?.user ?? null);
                if (session?.user) {
                    // Non-blocking profile fetch - pass user for auto-create
                    fetchProfile(session.user.id, session.user).catch(console.error);
                } else {
                    setProfile(null);
                }
                // Don't wait for profile - set loading false immediately
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
