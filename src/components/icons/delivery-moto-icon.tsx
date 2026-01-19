import React from 'react';

interface DeliveryMotoIconProps {
    className?: string;
    size?: number;
}

export function DeliveryMotoIcon({ className = '', size = 80 }: DeliveryMotoIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Mochila de delivery */}
            <rect x="15" y="20" width="22" height="28" rx="3" fill="#F97316" />
            <rect x="17" y="22" width="18" height="3" rx="1" fill="#EA580C" />
            <rect x="17" y="27" width="18" height="2" rx="1" fill="#FDBA74" opacity="0.5" />

            {/* Tirantes de mochila */}
            <path d="M32 48 L38 55" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
            <path d="M20 48 L26 55" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />

            {/* Cuerpo del conductor */}
            <ellipse cx="45" cy="52" rx="12" ry="8" fill="#F97316" />
            <path d="M38 48 C38 42 52 42 52 48" fill="#FFFFFF" />

            {/* Casco */}
            <circle cx="52" cy="32" r="12" fill="#F97316" />
            <path d="M40 32 C40 24 64 24 64 32 L64 35 C64 37 62 38 52 38 C42 38 40 37 40 35 Z" fill="#F97316" />
            <path d="M44 30 L60 30 L60 36 C60 37 58 38 52 38 C46 38 44 37 44 36 Z" fill="#1F2937" opacity="0.8" />
            <ellipse cx="52" cy="33" rx="7" ry="3" fill="#374151" opacity="0.6" />

            {/* Brazo */}
            <path d="M52 45 Q60 48 68 42" stroke="#F97316" strokeWidth="6" strokeLinecap="round" />
            <circle cx="68" cy="42" r="3" fill="#FBBF24" />

            {/* Moto - Cuerpo principal */}
            <path d="M45 60 Q55 55 75 58 Q82 60 80 68 L45 70 Q40 68 45 60" fill="#FFFFFF" />
            <path d="M50 62 Q60 58 72 60" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />

            {/* Asiento */}
            <ellipse cx="50" cy="58" rx="8" ry="3" fill="#1F2937" />

            {/* Manubrio */}
            <path d="M72 45 L78 38 L82 40" stroke="#374151" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="82" cy="40" r="2" fill="#1F2937" />

            {/* Faro */}
            <ellipse cx="80" cy="55" rx="4" ry="3" fill="#FBBF24" />
            <ellipse cx="80" cy="55" rx="2" ry="1.5" fill="#FEF3C7" />

            {/* Rueda trasera */}
            <circle cx="30" cy="75" r="14" fill="#1F2937" />
            <circle cx="30" cy="75" r="10" fill="#374151" />
            <circle cx="30" cy="75" r="4" fill="#6B7280" />
            <circle cx="30" cy="75" r="14" stroke="#F97316" strokeWidth="2" fill="none" />

            {/* Rueda delantera */}
            <circle cx="78" cy="75" r="12" fill="#1F2937" />
            <circle cx="78" cy="75" r="8" fill="#374151" />
            <circle cx="78" cy="75" r="3" fill="#6B7280" />
            <circle cx="78" cy="75" r="12" stroke="#F97316" strokeWidth="2" fill="none" />

            {/* Guardafangos */}
            <path d="M20 65 Q30 60 40 65" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M70 62 Q78 58 86 62" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* Motor/Detalles */}
            <rect x="45" y="68" width="20" height="6" rx="2" fill="#F97316" />
            <circle cx="55" cy="71" r="2" fill="#1F2937" />
        </svg>
    );
}
