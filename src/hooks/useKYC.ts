// src/hooks/useKYC.ts
// Hook for managing KYC state and operations

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type KYCStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export interface KYCState {
    status: KYCStatus;
    rejectionReason: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    isLoading: boolean;
    error: string | null;
}

export interface UseKYCReturn extends KYCState {
    canOperate: boolean;
    canToggleAvailable: boolean;
    refetch: () => Promise<void>;
    uploadKYC: (files: KYCFiles) => Promise<UploadResult>;
    resetForResubmit: () => Promise<void>;
}

export interface KYCFiles {
    ineFront: File;
    ineBack: File;
    selfie: File;
}

export interface UploadResult {
    success: boolean;
    folderUrl?: string;
    error?: string;
    message?: string;
}

export function useKYC(): UseKYCReturn {
    const [state, setState] = useState<KYCState>({
        status: 'not_submitted',
        rejectionReason: null,
        submittedAt: null,
        reviewedAt: null,
        isLoading: true,
        error: null,
    });

    const supabase = createClient();

    // Fetch KYC status from user profile
    const refetch = useCallback(async () => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setState(prev => ({ ...prev, isLoading: false, error: 'Not authenticated' }));
                return;
            }

            const { data: profile, error } = await supabase
                .from('users')
                .select('kyc_status, kyc_rejection_reason, kyc_submitted_at, kyc_reviewed_at')
                .eq('id', user.id)
                .single();

            if (error) {
                setState(prev => ({ ...prev, isLoading: false, error: error.message }));
                return;
            }

            setState({
                status: profile.kyc_status as KYCStatus,
                rejectionReason: profile.kyc_rejection_reason,
                submittedAt: profile.kyc_submitted_at,
                reviewedAt: profile.kyc_reviewed_at,
                isLoading: false,
                error: null,
            });
        } catch (err) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: err instanceof Error ? err.message : 'Unknown error',
            }));
        }
    }, [supabase]);

    // Initial fetch
    useEffect(() => {
        refetch();
    }, [refetch]);

    // Upload KYC documents
    const uploadKYC = useCallback(async (files: KYCFiles): Promise<UploadResult> => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('Not authenticated');
            }

            const formData = new FormData();
            formData.append('ine_front', files.ineFront);
            formData.append('ine_back', files.ineBack);
            formData.append('selfie', files.selfie);

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/upload-kyc`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: formData,
                }
            );

            const result = await response.json();

            if (!result.success) {
                setState(prev => ({ ...prev, isLoading: false, error: result.message || result.error }));
                return { success: false, error: result.error, message: result.message };
            }

            // Refetch to update state
            await refetch();

            return {
                success: true,
                folderUrl: result.data.folder_url,
            };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Upload failed';
            setState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
            return { success: false, error: 'UPLOAD_FAILED', message: errorMsg };
        }
    }, [supabase, refetch]);

    // Reset for resubmit (after rejection)
    const resetForResubmit = useCallback(async () => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('Not authenticated');
            }

            const { data, error } = await supabase.rpc('reset_kyc_for_resubmit', {
                p_user_id: user.id,
            });

            if (error) {
                throw new Error(error.message);
            }

            if (!data.success) {
                throw new Error(data.error || 'Failed to reset KYC');
            }

            await refetch();
        } catch (err) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: err instanceof Error ? err.message : 'Failed to reset',
            }));
        }
    }, [supabase, refetch]);

    // Computed values
    const canOperate = state.status === 'approved';
    const canToggleAvailable = state.status === 'approved';

    return {
        ...state,
        canOperate,
        canToggleAvailable,
        refetch,
        uploadKYC,
        resetForResubmit,
    };
}
