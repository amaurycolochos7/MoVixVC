'use client';

// src/components/kyc/KYCForm.tsx
// Form component for uploading KYC documents

import { useState, useRef, ChangeEvent } from 'react';
import { useKYC, KYCFiles } from '@/hooks/useKYC';
import { Camera, Upload, X, Check, Loader2, AlertCircle } from 'lucide-react';

interface FilePreview {
    file: File | null;
    preview: string | null;
}

interface FormState {
    ineFront: FilePreview;
    ineBack: FilePreview;
    selfie: FilePreview;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function KYCForm() {
    const { uploadKYC, isLoading } = useKYC();
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [formState, setFormState] = useState<FormState>({
        ineFront: { file: null, preview: null },
        ineBack: { file: null, preview: null },
        selfie: { file: null, preview: null },
    });

    const ineFrontRef = useRef<HTMLInputElement>(null);
    const ineBackRef = useRef<HTMLInputElement>(null);
    const selfieRef = useRef<HTMLInputElement>(null);

    const validateFile = (file: File): string | null => {
        if (!ALLOWED_TYPES.includes(file.type)) {
            return 'Solo se permiten archivos JPG, PNG o WebP';
        }
        if (file.size > MAX_FILE_SIZE) {
            return 'El archivo debe ser menor a 5MB';
        }
        return null;
    };

    const handleFileChange = (field: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);

        // Revoke previous preview URL if exists
        if (formState[field].preview) {
            URL.revokeObjectURL(formState[field].preview!);
        }

        setFormState(prev => ({
            ...prev,
            [field]: {
                file,
                preview: URL.createObjectURL(file),
            },
        }));
    };

    const clearFile = (field: keyof FormState) => () => {
        if (formState[field].preview) {
            URL.revokeObjectURL(formState[field].preview!);
        }
        setFormState(prev => ({
            ...prev,
            [field]: { file: null, preview: null },
        }));
        // Clear the input
        const refs = { ineFront: ineFrontRef, ineBack: ineBackRef, selfie: selfieRef };
        const inputRef = refs[field];
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const isFormValid = formState.ineFront.file && formState.ineBack.file && formState.selfie.file;

    const handleSubmit = async () => {
        if (!isFormValid) {
            setError('Por favor sube los 3 documentos requeridos');
            return;
        }

        setError(null);
        setIsUploading(true);

        const files: KYCFiles = {
            ineFront: formState.ineFront.file!,
            ineBack: formState.ineBack.file!,
            selfie: formState.selfie.file!,
        };

        const result = await uploadKYC(files);

        setIsUploading(false);

        if (result.success) {
            setSuccess(true);
        } else {
            setError(result.message || 'Error al enviar documentos');
        }
    };

    if (success) {
        return (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                    ¡Documentos enviados!
                </h3>
                <p className="text-green-700 dark:text-green-300 text-sm">
                    Tu verificación está en proceso. Te notificaremos cuando sea revisada.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Verificación de Identidad
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Sube las fotos de tu INE y una selfie para verificar tu cuenta
                </p>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                </div>
            )}

            {/* INE Frente */}
            <FileUploadCard
                title="INE - Frente"
                description="Foto clara de la parte frontal de tu INE"
                icon={<Upload className="w-6 h-6" />}
                preview={formState.ineFront.preview}
                onClear={clearFile('ineFront')}
                onClick={() => ineFrontRef.current?.click()}
                disabled={isUploading}
            />
            <input
                ref={ineFrontRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange('ineFront')}
                className="hidden"
            />

            {/* INE Atrás */}
            <FileUploadCard
                title="INE - Reverso"
                description="Foto clara de la parte trasera de tu INE"
                icon={<Upload className="w-6 h-6" />}
                preview={formState.ineBack.preview}
                onClear={clearFile('ineBack')}
                onClick={() => ineBackRef.current?.click()}
                disabled={isUploading}
            />
            <input
                ref={ineBackRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange('ineBack')}
                className="hidden"
            />

            {/* Selfie */}
            <FileUploadCard
                title="Selfie"
                description="Toma una foto de tu rostro con buena iluminación"
                icon={<Camera className="w-6 h-6" />}
                preview={formState.selfie.preview}
                onClear={clearFile('selfie')}
                onClick={() => selfieRef.current?.click()}
                disabled={isUploading}
            />
            <input
                ref={selfieRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                onChange={handleFileChange('selfie')}
                className="hidden"
            />

            {/* Submit Button */}
            <button
                onClick={handleSubmit}
                disabled={!isFormValid || isUploading || isLoading}
                className={`
          w-full py-4 px-6 rounded-xl font-semibold text-white
          flex items-center justify-center gap-2
          transition-all duration-200
          ${isFormValid && !isUploading
                        ? 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
                        : 'bg-gray-400 cursor-not-allowed'
                    }
        `}
            >
                {isUploading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Subiendo documentos...
                    </>
                ) : (
                    <>
                        <Check className="w-5 h-5" />
                        Enviar para verificación
                    </>
                )}
            </button>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Tus documentos serán revisados en un plazo de 24-48 horas.
                <br />
                Recibirás una notificación cuando tu cuenta sea verificada.
            </p>
        </div>
    );
}

// Sub-component for file upload cards
interface FileUploadCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    preview: string | null;
    onClear: () => void;
    onClick: () => void;
    disabled?: boolean;
}

function FileUploadCard({
    title,
    description,
    icon,
    preview,
    onClear,
    onClick,
    disabled,
}: FileUploadCardProps) {
    return (
        <div
            className={`
        relative border-2 border-dashed rounded-xl overflow-hidden
        transition-all duration-200
        ${preview
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                }
        ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
      `}
            onClick={!preview ? onClick : undefined}
        >
            {preview ? (
                <div className="relative">
                    <img
                        src={preview}
                        alt={title}
                        className="w-full h-40 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClear();
                            }}
                            className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full">
                        <Check className="w-4 h-4" />
                    </div>
                </div>
            ) : (
                <div className="p-6 flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
                        {icon}
                    </div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                        {title}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {description}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        JPG, PNG o WebP · Máx. 5MB
                    </p>
                </div>
            )}
        </div>
    );
}
