"use client";

import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface AddressAutocompleteProps {
    onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
    placeholder?: string;
    defaultValue?: string;
    className?: string;
}

export function AddressAutocomplete({
    onPlaceSelect,
    placeholder = "Buscar dirección...",
    defaultValue = "",
    className
}: AddressAutocompleteProps) {
    const placesLib = useMapsLibrary("places");
    const [placeAutocomplete, setPlaceAutocomplete] =
        useState<google.maps.places.Autocomplete | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!placesLib || !inputRef.current) return;

        const options: google.maps.places.AutocompleteOptions = {
            fields: ["geometry", "name", "formatted_address"],
            componentRestrictions: { country: "mx" }, // Limit to Mexico
        };

        setPlaceAutocomplete(new placesLib.Autocomplete(inputRef.current, options));
    }, [placesLib]);

    useEffect(() => {
        if (!placeAutocomplete) return;

        const listener = placeAutocomplete.addListener("place_changed", () => {
            const place = placeAutocomplete.getPlace();
            onPlaceSelect(place);
        });

        return () => {
            google.maps.event.removeListener(listener);
        };
    }, [placeAutocomplete, onPlaceSelect]);

    return (
        <Input
            ref={inputRef}
            defaultValue={defaultValue}
            placeholder={placeholder}
            className={className}
        />
    );
}
