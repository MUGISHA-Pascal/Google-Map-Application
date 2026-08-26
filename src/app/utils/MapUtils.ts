/* eslint-disable @typescript-eslint/no-explicit-any */
import { Loader } from "@googlemaps/js-api-loader";
import type { Address } from "@/types";

export const loader = new Loader({
  // apiKey: 'AIzaSyDoG2uuqTFfKF2HD1AWmCvEk70M-ojdsxw',
  apiKey: "AIzaSyApxJVBz6gc3MGVqK_GFWQuhnejC9Z0J5Y",
  version: "weekly",
  libraries: ["places", "geometry", "marker"],
});

// this is to get Lat from address
export const getLatLngFromAddress = async (
  address: Address
): Promise<google.maps.LatLngLiteral | null> => {
  const google = await loader.load();
  const geocoder = new google.maps.Geocoder();

  try {
    const response = await geocoder.geocode({
      address: `${address.Address}, ${address.City}, ${address.State}, ${address.Country}, ${address.ZIP}`,
    });

    if (response.results[0]) {
      return {
        lat: response.results[0].geometry.location.lat(),
        lng: response.results[0].geometry.location.lng(),
      };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};

export const parseLatLng = (
  latLng: string
): google.maps.LatLngLiteral | null => {
  if (!latLng) return null;
  const [lat, lng] = latLng
    .split(",")
    .map((coord) => Number.parseFloat(coord.trim()));
  return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
};

export interface AddressComponents {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export async function reverseGeocode({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}): Promise<AddressComponents> {
  const google = await loader.load();
  const geocoder = new google.maps.Geocoder();

  try {
    // Use a more detailed geocoding request
    const response = await geocoder.geocode({
      location: { lat, lng },
      language: "en", // Ensure results are in English
    });

    if (response.results && response.results.length > 0) {
      // Try to get the most detailed result first
      const detailedResult =
        response.results.find(
          (r) =>
            r.types.includes("street_address") || r.types.includes("premise")
        ) || response.results[0];

      const addressComponents = detailedResult.address_components;

      let street = "";
      let streetNumber = "";
      let route = "";
      let city = "";
      let state = "";
      let postalCode = "";
      let country = "";
      let neighborhood = "";
      let sublocality = "";

      // Parse address components with more detail
      addressComponents.forEach((component: any) => {
        const types = component.types;

        if (types.includes("street_number")) {
          streetNumber = component.long_name;
        }
        if (types.includes("route")) {
          route = component.long_name;
        }
        if (types.includes("locality") || types.includes("postal_town")) {
          city = component.long_name;
        }
        if (types.includes("administrative_area_level_1")) {
          state = component.long_name;
        }
        if (types.includes("postal_code")) {
          postalCode = component.long_name;
        }
        if (types.includes("country")) {
          country = component.long_name;
        }
        if (types.includes("neighborhood")) {
          neighborhood = component.long_name;
        }
        if (
          types.includes("sublocality") ||
          types.includes("sublocality_level_1")
        ) {
          sublocality = component.long_name;
        }
      });

      // Combine street number and route for a complete street address
      if (streetNumber && route) {
        street = `${streetNumber} ${route}`;
      } else if (route) {
        street = route;
      }

      // If city is still empty, try to use other components
      if (!city) {
        if (sublocality) {
          city = sublocality;
        } else if (neighborhood) {
          city = neighborhood;
        } else {
          // Try administrative_area_level_2 or administrative_area_level_3 as fallback
          const adminArea = addressComponents.find(
            (c: any) =>
              c.types.includes("administrative_area_level_2") ||
              c.types.includes("administrative_area_level_3")
          );
          if (adminArea) {
            city = adminArea.long_name;
          }
        }
      }

      // If we still don't have a city but have a formatted address, extract something useful
      if (!city && detailedResult.formatted_address) {
        const parts = detailedResult.formatted_address
          .split(",")
          .map((p) => p.trim());
        if (parts.length > 1) {
          // The second part is often a city or area
          city = parts[1];
        }
      }

      console.log("Detailed geocoding result:", {
        street,
        city,
        state,
        postalCode,
        country,
        formatted_address: detailedResult.formatted_address,
      });

      return {
        street:
          street ||
          (detailedResult.formatted_address
            ? detailedResult.formatted_address.split(",")[0]
            : ""),
        city,
        state,
        postalCode,
        country,
      };
    }

    throw new Error("No results found");
  } catch (error) {
    console.error("Error in reverse geocoding:", error);
    return {
      street: "",
      city: "Unknown Location",
      state: "",
      postalCode: "",
      country: "Unknown Country",
    };
  }
}
