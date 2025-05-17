"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import {
  loader,
  getLatLngFromAddress,
  parseLatLng,
  reverseGeocode,
} from "@/app/utils/MapUtils";
import type { SiteMarker, InterConnectSegment, Address } from "@/types";
import html2canvas from "html2canvas";
import DataPreview from "./DataPreview";

interface AddressInfo {
  city?: string;
  state?: string;
  country?: string;
  street?: string;
  postalCode?: string;
}

interface Props {
  markers: SiteMarker[];
  interconnects: InterConnectSegment[];
  interconnectPathStyle: number;
  fnClick?: (
    name?: string,
    latlng?: { lat: number; lng: number },
    address?: string
  ) => void;
  fnDblClick?: (name?: string) => void;
  fnCtrlClick?: (name?: string) => void;
  fnSave?: (
    updatedMarkers: SiteMarker[],
    updatedInterconnects: InterConnectSegment[]
  ) => void;
}

export default function GoogleMap({
  markers,
  interconnects,
  interconnectPathStyle,
  fnClick,
  fnDblClick,
  fnCtrlClick,
  fnSave,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [updatedMarkers, setUpdatedMarkers] = useState<SiteMarker[]>([
    ...markers,
  ]);
  const [updatedInterconnects, setUpdatedInterconnects] = useState<
    InterConnectSegment[]
  >([...interconnects]);
  const [showPopup, setShowPopup] = useState(false);
  const [draggedMarkers, setDraggedMarkers] = useState<Set<string>>(new Set());
  const [previousMarkerStates, setPreviousMarkerStates] = useState<
    Map<string, SiteMarker>
  >(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Refs to store map objects
  const markersRef = useRef<
    Map<string, google.maps.marker.AdvancedMarkerElement>
  >(new Map());
  const polylinesRef = useRef<Map<string, google.maps.Polyline>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Keep track of processed markers for state updates
  const processedMarkersRef = useRef<SiteMarker[]>([]);

  // Initialize Google Map
  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return;

      const google = await loader.load();

      // Clear any existing map instance
      if (map) {
        // Remove all overlays and listeners
        google.maps.event.clearInstanceListeners(map);
      }

      const newMap = new google.maps.Map(mapRef.current, {
        zoom: 4,
        center: { lat: 20, lng: 0 },
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        restriction: {
          latLngBounds: {
            north: 85,
            south: -85,
            west: -180,
            east: 180,
          },
          strictBounds: true,
        },
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
        mapId: "4504f8b37365c3d0",
      });

      setMap(newMap);

      // Clear any existing info windows
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
      infoWindowRef.current = new google.maps.InfoWindow({
        maxWidth: 320,
        disableAutoPan: false,
      });

      // Set initial bounds based on markers
      if (markers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        let hasValidMarkers = false;

        markers.forEach((marker) => {
          const position = parseLatLng(marker.LatLng);
          if (position) {
            bounds.extend(position);
            hasValidMarkers = true;
          }
        });

        if (hasValidMarkers) {
          newMap.fitBounds(bounds);
          // Add some padding to the bounds
          const padding = {
            top: 50,
            right: 50,
            bottom: 50,
            left: 50,
          };
          newMap.panToBounds(bounds, padding);
        }
      }
    };

    // Call initMap
    initMap();

    // Cleanup function
    return () => {
      // Clear all markers
      markersRef.current.forEach((marker) => {
        marker.map = null;
      });
      markersRef.current.clear();

      // Clear all polylines
      polylinesRef.current.forEach((polyline) => {
        polyline.setMap(null);
      });
      polylinesRef.current.clear();

      // Clear info window
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
    };
  }, []); // Empty dependency array since we only want this to run once on mount

  // Update local state when props change
  useEffect(() => {
    // Only update if we're NOT in edit mode
    if (!editMode) {
      setUpdatedMarkers([...markers]);
      setUpdatedInterconnects([...interconnects]);
    }
  }, [markers, interconnects, editMode]);

  // Function to find interconnects connected to a marker
  const findConnectedInterconnects = (markerName: string) => {
    return interconnects.filter(
      (ic) =>
        ic.Source &&
        ic.Target && // Ensure Source and Target exist
        (ic.Source === markerName || ic.Target === markerName)
    );
  };

  // Update connected paths when a marker is moved
  const updateConnectedPaths = async (
    oldMarkerName: string,
    newMarkerName: string,
    newPosition: google.maps.LatLng
  ) => {
    const connectedInterconnects = findConnectedInterconnects(oldMarkerName);

    connectedInterconnects.forEach((interconnect) => {
      if (!interconnect.Source || !interconnect.Target) return;

      const polylineKey = `${interconnect.Source}-${interconnect.Target}`;
      const polyline = polylinesRef.current.get(polylineKey);

      if (polyline) {
        const currentPath = polyline.getPath().getArray();
        let newPath;

        // Update the appropriate end of the path based on whether this is source or target
        if (interconnect.Source === oldMarkerName) {
          newPath = [newPosition, ...currentPath.slice(1)];
        } else if (interconnect.Target === oldMarkerName) {
          newPath = [...currentPath.slice(0, -1), newPosition];
        }

        if (newPath) {
          polyline.setPath(newPath);

          // Update the interconnect data with new marker name
          setUpdatedInterconnects((prevInterconnects) =>
            prevInterconnects.map((ic) =>
              ic.Source === oldMarkerName || ic.Target === oldMarkerName
                ? {
                    ...ic,
                    Source:
                      ic.Source === oldMarkerName ? newMarkerName : ic.Source,
                    Target:
                      ic.Target === oldMarkerName ? newMarkerName : ic.Target,
                    WaypointLatLngArray: newPath
                      .slice(1, -1)
                      .map((p: google.maps.LatLng) => {
                        const lat =
                          typeof p.lat === "function" ? p.lat() : p.lat;
                        const lng =
                          typeof p.lng === "function" ? p.lng() : p.lng;
                        return `${lat} ${lng}`;
                      })
                      .join(", "),
                    Update: "1",
                  }
                : ic
            )
          );
        }
      }
    });
  };

  // Function to create a professional tooltip for a marker
  const createProfessionalTooltip = (addressInfo: any, markerName: string) => {
    // Create a more descriptive tooltip with available information
    const tooltipLines = [];

    // Add location name
    if (addressInfo.city && addressInfo.country) {
      tooltipLines.push(
        `Location: ${addressInfo.city}, ${addressInfo.country}`
      );
    } else if (addressInfo.city) {
      tooltipLines.push(`Location: ${addressInfo.city}`);
    } else if (addressInfo.country) {
      tooltipLines.push(`Location: ${addressInfo.country}`);
    } else {
      tooltipLines.push(`Location: ${markerName}`);
    }

    // Add street address if available
    if (addressInfo.street) {
      tooltipLines.push(`Address: ${addressInfo.street}`);
    }

    // Add state/region if available
    if (addressInfo.state) {
      tooltipLines.push(`Region: ${addressInfo.state}`);
    }

    // Add postal code if available
    if (addressInfo.postalCode) {
      tooltipLines.push(`Postal Code: ${addressInfo.postalCode}`);
    }

    return tooltipLines.join("\\n");
  };

  // Function to create professional details for a marker
  const createProfessionalDetails = (addressInfo: any, markerName: string) => {
    // Create more detailed information
    const detailLines = [];

    // Add a title line
    if (addressInfo.city && addressInfo.country) {
      detailLines.push(`${addressInfo.city}, ${addressInfo.country} Details`);
    } else {
      detailLines.push(`${markerName} Details`);
    }

    // Add full address
    if (addressInfo.street) {
      detailLines.push(`Address: ${addressInfo.street}`);
    }

    // Add city
    if (addressInfo.city) {
      detailLines.push(`City: ${addressInfo.city}`);
    }

    // Add state/region
    if (addressInfo.state) {
      detailLines.push(`State/Region: ${addressInfo.state}`);
    }

    // Add postal code
    if (addressInfo.postalCode) {
      detailLines.push(`Postal Code: ${addressInfo.postalCode}`);
    }

    // Add country
    if (addressInfo.country) {
      detailLines.push(`Country: ${addressInfo.country}`);
    }

    return detailLines.join("\\n");
  };

  // Process and update markers
  useEffect(() => {
    if (!map) return;

    // Reset processed markers collection
    processedMarkersRef.current = [];

    // Declare listener variables
    const clickListener: google.maps.MapsEventListener | null = null;
    const mouseoverListener: google.maps.MapsEventListener | null = null;

    // Remove existing markers
    markersRef.current.forEach((marker) => {
      marker.map = null;
    });
    markersRef.current.clear();

    // Create new markers
    const processMarkers = async () => {
      const google = await loader.load();
      const tempMarkers: SiteMarker[] = [];

      for (const marker of updatedMarkers) {
        let position = parseLatLng(marker.LatLng);
        const updatedMarker = { ...marker };

        if (!position) {
          console.log("Position is not there");
          try {
            // Clean and fix the Address string
            let cleanedAddress = marker.Address.replace(/""/g, '"').trim();

            // Add double quotes around property names
            cleanedAddress = cleanedAddress.replace(/(\w+):/g, '"$1":');
            // Parse the cleaned string
            const address = JSON.parse(cleanedAddress) as Address;
            position = await getLatLngFromAddress(address);
            console.log("Parsed Address: ", address);
            console.log(
              "The positions for the non-positioned records: ",
              position
            );

            if (position) {
              updatedMarker.LatLng = `${position.lat}, ${position.lng}`;
              updatedMarker.Update = "1";
            } else {
              updatedMarker.Update = "-1";
            }
          } catch (error) {
            console.error("Error in processing marker:", error);
            updatedMarker.Update = "-1";
          }
        }

        if (position) {
          const mapMarker = new google.maps.marker.AdvancedMarkerElement({
            position,
            map,
            title: marker.Name,
            gmpDraggable: editMode,
            gmpClickable: true,
          });

          // Store click listener reference so we can remove it later
          let clickListener: google.maps.MapsEventListener | null = null;
          let mouseoutListener: google.maps.MapsEventListener | null = null;
          let mouseoverListener: google.maps.MapsEventListener | null = null;

          // Remove existing listeners if they exist
          const removeExistingListeners = () => {
            if (clickListener) google.maps.event.removeListener(clickListener);
            if (mouseoutListener)
              google.maps.event.removeListener(mouseoutListener);
            if (mouseoverListener)
              google.maps.event.removeListener(mouseoverListener);
          };

          // Add new listeners
          const addMarkerListeners = () => {
            removeExistingListeners();

            mouseoutListener = mapMarker.addListener("mouseout", () => {
              infoWindowRef.current?.close();
            });

            mouseoverListener = mapMarker.addListener("mouseover", async () => {
              // Get current position for fresh data
              const position = mapMarker.position;
              if (!position) return;

              const lat =
                typeof position.lat === "function"
                  ? position.lat()
                  : position.lat;
              const lng =
                typeof position.lng === "function"
                  ? position.lng()
                  : position.lng;

              // Create a professional tooltip with current location data
              let tooltipContent = "";

              if (marker.tooltip) {
                // Use existing tooltip
                tooltipContent = `
                  <div style="font-family: Arial, sans-serif; padding: 8px;">
                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px; color: #333;">${
                      marker.Name
                    }</div>
                    <div style="font-size: 14px; color: #555;">
                      ${marker.tooltip.replace(/\\n/g, "<br>")}
                    </div>
                  </div>
                `;
              } else {
                // Create a basic tooltip
                tooltipContent = `
                  <div style="font-family: Arial, sans-serif; padding: 8px;">
                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px; color: #333;">${
                      marker.Name
                    }</div>
                    <div style="font-size: 14px; color: #555;">
                      Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}
                    </div>
                  </div>
                `;
              }

              infoWindowRef.current?.setContent(tooltipContent);
              infoWindowRef.current?.open(map, mapMarker);
            });

            clickListener = mapMarker.addListener("click", async () => {
              const position = mapMarker.position;
              if (!position) return;

              const lat =
                typeof position.lat === "function"
                  ? position.lat()
                  : position.lat;
              const lng =
                typeof position.lng === "function"
                  ? position.lng()
                  : position.lng;

              // Get fresh address information for current position
              const addressInfo = await reverseGeocode({ lat, lng });

              // Create location string with only available components
              const locationParts = [];
              if (addressInfo.city) locationParts.push(addressInfo.city);
              if (addressInfo.state) locationParts.push(addressInfo.state);
              if (addressInfo.country) locationParts.push(addressInfo.country);

              const locationString = locationParts.join(", ");

              // Format the content with a more professional look
              const content = `
                <div style="font-family: Arial, sans-serif; padding: 12px; max-width: 300px;">
                  <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                    ${marker.Name}
                  </div>
                  
                  <div style="margin-bottom: 12px;">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #555;">Location:</div>
                    <div style="color: #333; font-size: 14px;">${
                      locationString || "Unknown location"
                    }</div>
                  </div>
                  
                  ${
                    addressInfo.street
                      ? `
                    <div style="margin-bottom: 12px;">
                      <div style="font-weight: 600; margin-bottom: 4px; color: #555;">Address:</div>
                      <div style="color: #333; font-size: 14px;">${addressInfo.street}</div>
                    </div>
                  `
                      : ""
                  }
                  
                  <div style="margin-bottom: 8px;">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #555;">Coordinates:</div>
                    <div style="color: #333; font-size: 14px; font-family: monospace;">${lat.toFixed(
                      6
                    )}, ${lng.toFixed(6)}</div>
                  </div>
                </div>
              `;

              // Set the content
              infoWindowRef.current?.setContent(content);
              infoWindowRef.current?.open(map, mapMarker);
            });
          };

          // Initial addition of listeners
          addMarkerListeners();

          if (editMode) {
            // Enhanced drag event handler with loading indicator and professional formatting
            mapMarker.addListener("dragstart", () => {
              // Show loading indicator on the marker or nearby
              setIsLoading(true);

              // Store the previous state if not already stored
              if (!previousMarkerStates.has(marker.Name)) {
                console.log("Storing previous state for:", marker.Name);
                setPreviousMarkerStates((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(marker.Name, { ...marker });
                  return newMap;
                });
              }
            });

            mapMarker.addListener(
              "dragend",
              async (event: google.maps.MapMouseEvent) => {
                if (event.latLng) {
                  const newLat = event.latLng.lat();
                  const newLng = event.latLng.lng();

                  try {
                    // Show loading indicator
                    const loadingContent = `
                    <div style="font-family: Arial, sans-serif; padding: 12px; text-align: center;">
                      <div style="margin-bottom: 8px; font-weight: bold;">Updating location data...</div>
                      <div style="display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(0,0,0,0.1); border-radius: 50%; border-top-color: #3498db; animation: spin 1s linear infinite;"></div>
                      <style>
                        @keyframes spin {
                          0% { transform: rotate(0deg); }
                          100% { transform: rotate(360deg); }
                        }
                      </style>
                    </div>
                  `;
                    infoWindowRef.current?.setContent(loadingContent);
                    infoWindowRef.current?.open(map, mapMarker);

                    // Get detailed address information for the new location
                    const addressInfo = await reverseGeocode({
                      lat: newLat,
                      lng: newLng,
                    });

                    // Create a professional name for the marker based on location
                    let newName = marker.Name;

                    // Only update the name if we have good location data and it's significantly different
                    // This prevents unnecessary name changes for small movements
                    if (addressInfo.city && addressInfo.country) {
                      // Check if the location has changed significantly
                      const oldNameParts = marker.Name.split(",").map((part) =>
                        part.trim().toLowerCase()
                      );
                      const newCityCountry = `${addressInfo.city}, ${addressInfo.country}`;

                      // If the current name doesn't contain the new city and country, update it
                      if (
                        !oldNameParts.includes(
                          addressInfo.city.toLowerCase()
                        ) &&
                        !oldNameParts.includes(
                          addressInfo.country.toLowerCase()
                        )
                      ) {
                        newName = newCityCountry;
                      }
                    }

                    // Create properly formatted address string
                    const formattedAddress = JSON.stringify({
                      Address: addressInfo.street || "",
                      City: addressInfo.city || "",
                      State: addressInfo.state || "",
                      ZIP: addressInfo.postalCode || "",
                      Country: addressInfo.country || "",
                    });

                    // Create professional tooltip and details
                    const newTooltip = createProfessionalTooltip(
                      addressInfo,
                      newName
                    );
                    const newDetails = createProfessionalDetails(
                      addressInfo,
                      newName
                    );

                    console.log("Marker dragged:", marker.Name);
                    console.log("New position:", { lat: newLat, lng: newLng });
                    console.log("New name:", newName);
                    console.log("Address info:", addressInfo);

                    // Add to dragged markers set
                    setDraggedMarkers(
                      (prev) => new Set([...prev, marker.Name])
                    );

                    // Update the marker with new information
                    setUpdatedMarkers((prevMarkers) =>
                      prevMarkers.map((m) =>
                        m.Name === marker.Name
                          ? {
                              ...m,
                              Name: newName, // Update the name to reflect the new location
                              LatLng: `${newLat}, ${newLng}`,
                              Address: formattedAddress,
                              tooltip: newTooltip,
                              Details: newDetails,
                              Update: "1",
                            }
                          : m
                      )
                    );

                    // Update connected paths
                    await updateConnectedPaths(
                      marker.Name,
                      newName,
                      event.latLng
                    );

                    // Update the marker title to reflect the new name
                    mapMarker.title = newName;

                    // Show success message
                    const successContent = `
                    <div style="font-family: Arial, sans-serif; padding: 12px; max-width: 300px;">
                      <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                        ${newName}
                      </div>
                      
                      <div style="margin-bottom: 12px;">
                        <div style="font-weight: 600; margin-bottom: 4px; color: #555;">Location updated:</div>
                        <div style="color: #333; font-size: 14px;">${
                          addressInfo.city ? addressInfo.city + ", " : ""
                        }${addressInfo.country || "Unknown location"}</div>
                      </div>
                      
                      ${
                        addressInfo.street
                          ? `
                        <div style="margin-bottom: 12px;">
                          <div style="font-weight: 600; margin-bottom: 4px; color: #555;">Address:</div>
                          <div style="color: #333; font-size: 14px;">${addressInfo.street}</div>
                        </div>
                      `
                          : ""
                      }
                      
                      <div style="margin-bottom: 8px;">
                        <div style="font-weight: 600; margin-bottom: 4px; color: #555;">Coordinates:</div>
                        <div style="color: #333; font-size: 14px; font-family: monospace;">${newLat.toFixed(
                          6
                        )}, ${newLng.toFixed(6)}</div>
                      </div>
                      
                      <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #eee; color: #28a745; font-weight: 500;">
                        Location data updated successfully
                      </div>
                    </div>
                  `;
                    infoWindowRef.current?.setContent(successContent);

                    // Hide loading indicator
                    setIsLoading(false);

                    // Update the marker reference with the new name
                    if (newName !== marker.Name) {
                      markersRef.current.set(newName, mapMarker);
                      markersRef.current.delete(marker.Name);
                    }
                  } catch (error) {
                    console.error("Error updating marker after drag:", error);

                    // Show error message
                    const errorContent = `
                    <div style="font-family: Arial, sans-serif; padding: 12px; max-width: 300px;">
                      <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                        ${marker.Name}
                      </div>
                      
                      <div style="margin-bottom: 12px;">
                        <div style="font-weight: 600; margin-bottom: 4px; color: #555;">Position updated:</div>
                        <div style="color: #333; font-size: 14px;">Coordinates: ${newLat.toFixed(
                          6
                        )}, ${newLng.toFixed(6)}</div>
                      </div>
                      
                      <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #eee; color: #dc3545; font-weight: 500;">
                        Could not retrieve location details. Position was updated.
                      </div>
                    </div>
                  `;
                    infoWindowRef.current?.setContent(errorContent);

                    // Hide loading indicator
                    setIsLoading(false);

                    // Still update the position even if geocoding fails
                    setUpdatedMarkers((prevMarkers) =>
                      prevMarkers.map((m) =>
                        m.Name === marker.Name
                          ? {
                              ...m,
                              LatLng: `${newLat}, ${newLng}`,
                              Update: "1",
                            }
                          : m
                      )
                    );
                  }
                }
              }
            );
          }

          markersRef.current.set(marker.Name, mapMarker);
        }

        // Add the processed marker to our temp array
        tempMarkers.push(updatedMarker);
      }

      // Only update state if markers have actually changed
      const hasMarkersChanged =
        JSON.stringify(tempMarkers) !== JSON.stringify(updatedMarkers);
      if (hasMarkersChanged) {
        setUpdatedMarkers(tempMarkers);
      }
      processedMarkersRef.current = tempMarkers;
    };

    processMarkers();

    // Adjust map bounds
    const bounds = new google.maps.LatLngBounds();
    updatedMarkers.forEach((marker) => {
      const position = parseLatLng(marker.LatLng);
      if (position) bounds.extend(position);
    });

    if (updatedMarkers.length > 1) {
      map.fitBounds(bounds);
    } else if (updatedMarkers.length === 1) {
      const singlePosition = parseLatLng(updatedMarkers[0].LatLng);
      if (singlePosition) {
        map.setCenter(singlePosition);
        map.setZoom(12);
      }
    }

    // Clean up listeners on component unmount
    return () => {
      if (clickListener) google.maps.event.removeListener(clickListener);
      if (mouseoverListener)
        google.maps.event.removeListener(mouseoverListener);
    };
  }, [map, editMode]); // Remove updatedMarkers from dependencies

  // Draw InterConnect paths
  useEffect(() => {
    if (!map) return;

    // Remove existing polylines
    polylinesRef.current.forEach((polyline) => {
      polyline.setMap(null);
    });
    polylinesRef.current.clear();

    // Make sure we're using the latest marker references
    const processInterconnects = async () => {
      const google = await loader.load();

      // Process each interconnect
      for (const segment of updatedInterconnects) {
        if (!segment.Source || !segment.Target) {
          console.log("Skipping interconnect with missing source or target");
          continue;
        }

        // Get marker references
        const sourceMarker = markersRef.current.get(segment.Source);
        const targetMarker = markersRef.current.get(segment.Target);

        // If either marker is missing, log and continue
        if (!sourceMarker || !targetMarker) {
          console.log(
            `Missing marker for interconnect ${segment.Source} -> ${segment.Target}`
          );

          // Optionally add visual indicators for missing endpoints
          if (!sourceMarker && !targetMarker) {
            console.log("Both source and target markers are missing");
            continue;
          }

          // Handle case where one marker exists but the other doesn't
          let existingMarkerPosition;
          let missingMarkerName;

          if (sourceMarker) {
            existingMarkerPosition = sourceMarker.position;
            missingMarkerName = segment.Target;
          } else if (targetMarker) {
            existingMarkerPosition = targetMarker.position;
            missingMarkerName = segment.Source;
          }

          if (existingMarkerPosition) {
            // Create a visual indicator for the missing endpoint
            new google.maps.Marker({
              position: existingMarkerPosition,
              map,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: "#ff0000",
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "#fff",
              },
              title: `Missing ${missingMarkerName} endpoint for interconnect`,
            });
          }

          continue;
        }

        // Get positions
        const sourcePosition = sourceMarker.position;
        const targetPosition = targetMarker.position;

        if (!sourcePosition || !targetPosition) {
          console.log("Invalid marker positions for interconnect");
          continue;
        }

        // Build path with waypoints if available
        let path = [sourcePosition];

        // Parse waypoints if available
        if (segment.WaypointLatLngArray) {
          try {
            // Handle different waypoint formats
            const waypointStr = segment.WaypointLatLngArray.replace(
              /[[\]]/g,
              ""
            );

            // Try comma-separated format first
            let waypoints = waypointStr
              .split(",")
              .map((coord) => {
                const [lat, lng] = coord.trim().split(/\s+/).map(Number);
                return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
              })
              .filter(Boolean);

            // If no valid waypoints, try arrow-separated format
            if (waypoints.length === 0) {
              waypoints = waypointStr
                .split("→")
                .map((coord) => {
                  const [lat, lng] = coord.trim().split(/\s+/).map(Number);
                  return isNaN(lat) || isNaN(lng) ? null : { lat, lng };
                })
                .filter(Boolean);
            }

            // Add valid waypoints to path
            if (waypoints.length > 0) {
              path = path.concat(waypoints);
            }
          } catch (error) {
            console.error("Error parsing waypoints:", error);
          }
        }

        // Add target position as final point
        path.push(targetPosition);

        // Create polyline with appropriate style
        const polyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: segment.LineColor || "#FF0000", // Default to red if not specified
          strokeOpacity: 1.0,
          strokeWeight: Number.parseInt(segment.LineWidthpx) || 3, // Default to 3px if not specified
          editable: editMode,
          map,
        });

        // Add event listeners for polyline
        polyline.addListener("mouseover", () => {
          if (segment.Desc) {
            infoWindowRef.current?.setContent(`
              <div style="font-family: Arial, sans-serif; padding: 8px;">
                <div style="font-weight: bold; margin-bottom: 5px;">${segment.Source} → ${segment.Target}</div>
                <div>${segment.Desc}</div>
              </div>
            `);
            infoWindowRef.current?.open(map);
            infoWindowRef.current?.setPosition(
              path[Math.floor(path.length / 2)]
            );
          }
        });

        polyline.addListener("mouseout", () => {
          infoWindowRef.current?.close();
        });

        // Store reference to polyline
        polylinesRef.current.set(
          `${segment.Source}-${segment.Target}`,
          polyline
        );
      }
    };

    processInterconnects();
  }, [map, updatedInterconnects, updatedMarkers, editMode]);

  // this is the function to save image
  const saveMapAsImage = async () => {
    if (!mapRef.current || !map) {
      console.error("Map reference or map is not available");
      return;
    }

    try {
      // Force redraw of markers using Google Maps API
      const google = await loader.load();

      // Temporarily add markers back to the map
      markers.forEach((marker) => {
        const position = parseLatLng(marker.LatLng);
        if (position) {
          new google.maps.Marker({
            position,
            map: map,
            title: marker.Name,
          });
        }
      });

      // Wait for rendering
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Capture the map with markers
      const canvas = await html2canvas(mapRef.current, {
        useCORS: true,
        allowTaint: true,
        logging: true,
      });

      // Create blob
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error("Canvas to Blob conversion failed");
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = "map_with_markers.png";
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (error) {
      console.error("Error saving map as image:", error);
      alert("Failed to save map as image: " + error);
    }
  };

  // this is to capture the current map and save it
  const captureAllMapElements = async () => {
    // Build the marker list from the current map state and updatedMarkers
    const allCurrentMarkers: SiteMarker[] = [];

    for (const [markerName, mapMarker] of markersRef.current.entries()) {
      try {
        const position = mapMarker.position;
        if (position) {
          const lat =
            typeof position.lat === "function" ? position.lat() : position.lat;
          const lng =
            typeof position.lng === "function" ? position.lng() : position.lng;

          // Find the marker in updatedMarkers (not original markers)
          const markerData = updatedMarkers.find((m) => m.Name === markerName);
          if (markerData) {
            allCurrentMarkers.push({
              ...markerData,
              LatLng: `${lat}, ${lng}`,
              Update: "1",
            });
          }
        }
      } catch (error) {
        console.error(`Error capturing marker ${markerName}:`, error);
      }
    }

    // Capture interconnects separately
    const allCurrentInterconnects: InterConnectSegment[] = [...interconnects]; // Start with all existing interconnects

    // Update only the visible interconnects that have been modified
    for (const [segmentName, polyline] of polylinesRef.current.entries()) {
      try {
        const path = polyline.getPath();
        if (path) {
          const waypointPath = path
            .getArray()
            .slice(1)
            .map(
              (coord) =>
                `${typeof coord.lat === "function" ? coord.lat() : coord.lat} ${
                  typeof coord.lng === "function" ? coord.lng() : coord.lng
                }`
            )
            .join(", ");

          // Split the segmentName to get Source and Target
          const [source, target] = segmentName.split("-");

          // Find and update the existing interconnect
          const index = allCurrentInterconnects.findIndex(
            (ic) => ic.Source === source && ic.Target === target
          );

          if (index !== -1) {
            // Only update if waypoints have changed
            const hasChanged =
              waypointPath !==
              allCurrentInterconnects[index].WaypointLatLngArray;
            allCurrentInterconnects[index] = {
              ...allCurrentInterconnects[index],
              WaypointLatLngArray: waypointPath,
              Update: hasChanged ? "1" : allCurrentInterconnects[index].Update,
            };
          }
        }
      } catch (error) {
        console.error(`Error capturing interconnect ${segmentName}:`, error);
      }
    }

    console.log("Captured data:", {
      markers: allCurrentMarkers,
      interconnects: allCurrentInterconnects,
    });

    return {
      markers: allCurrentMarkers,
      interconnects: allCurrentInterconnects,
    };
  };

  // This is to save
  const handleSave = async () => {
    if (fnSave) {
      try {
        // Show loading indicator or message
        const saveButton = document.querySelector(
          "button.bg-green-500"
        ) as HTMLButtonElement;
        if (saveButton) {
          const originalText = saveButton.textContent;
          saveButton.textContent = "Saving...";
          saveButton.disabled = true;
        }

        const {
          markers: capturedMarkers,
          interconnects: capturedInterconnects,
        } = await captureAllMapElements();

        console.log("Captured Markers:", capturedMarkers);
        console.log("Captured Interconnects:", capturedInterconnects);

        // Ensure all markers have the Update flag set
        const markersToSave = capturedMarkers.map((marker) => ({
          ...marker,
          Update: "1",
        }));

        // Ensure all interconnects have the Update flag set
        const interconnectsToSave = capturedInterconnects.map(
          (interconnect) => ({
            ...interconnect,
            Update: "1",
          })
        );

        // Save all markers and interconnects
        await fnSave(markersToSave, interconnectsToSave);

        // Clear the dragged markers set and previous states after saving
        setDraggedMarkers(new Set());
        setPreviousMarkerStates(new Map());

        // Update local state with captured data
        setUpdatedMarkers(markersToSave);
        setUpdatedInterconnects(interconnectsToSave);

        // Wait for state to update
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Save map as image
        await saveMapAsImage();

        // Reset button state
        if (saveButton) {
          saveButton.textContent = "SAVE";
          saveButton.disabled = false;
        }

        // Show success message
        alert("Map data saved successfully!");

        // Refresh the page
        window.location.reload();
      } catch (error) {
        console.error("Error in save process:", error);
        alert("Failed to save data. Please try again.");

        // Reset button state on error
        const saveButton = document.querySelector(
          "button.bg-green-500"
        ) as HTMLButtonElement;
        if (saveButton) {
          saveButton.textContent = "SAVE";
          saveButton.disabled = false;
        }
      }
    } else {
      console.error("Save function not provided");
      alert("Save function not provided");
    }
  };
  const handlePreview = async () => {
    // Directly capture the current map state
    const { markers: capturedMarkers, interconnects: capturedInterconnects } =
      await captureAllMapElements();

    console.log("Current markers data:", capturedMarkers);
    console.log("Current interconnects data:", capturedInterconnects);
    console.log(
      "Previous marker states:",
      Array.from(previousMarkerStates.entries())
    );

    // Check if there's actually data to display
    if (capturedMarkers.length === 0 && capturedInterconnects.length === 0) {
      alert(
        "No data available to preview. Try adding markers or interconnects first."
      );
      return;
    }

    // Update state with captured data
    setUpdatedMarkers(capturedMarkers);
    setUpdatedInterconnects(capturedInterconnects);

    // Then show the popup
    setShowPopup(true);
  };

  const getAddressFromCoordinates = async ({
    lat,
    lng,
  }: {
    lat: number;
    lng: number;
  }): Promise<AddressInfo> => {
    try {
      const google = await loader.load();
      const geocoder = new google.maps.Geocoder();

      const response = await geocoder.geocode({
        location: { lat, lng },
      });

      if (!response.results?.[0]) {
        throw new Error("No results found");
      }

      const addressInfo: AddressInfo = {};
      const result = response.results[0];

      // Extract address components
      result.address_components.forEach((component: any) => {
        const types = component.types;
        if (types.includes("locality")) {
          addressInfo.city = component.long_name;
        } else if (types.includes("administrative_area_level_1")) {
          addressInfo.state = component.long_name;
        } else if (types.includes("country")) {
          addressInfo.country = component.long_name;
        } else if (types.includes("route")) {
          addressInfo.street = component.long_name;
        } else if (types.includes("postal_code")) {
          addressInfo.postalCode = component.long_name;
        }
      });

      return addressInfo;
    } catch (error) {
      console.error("Error in reverse geocoding:", error);
      return {};
    }
  };

  return (
    <div>
      {/* Popup for JSON Preview */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
          <DataPreview
            markers={updatedMarkers}
            interconnects={updatedInterconnects}
            previousMarkers={Array.from(previousMarkerStates.values())}
            onClose={() => setShowPopup(false)}
            onSave={() => {
              handleSave();
              setShowPopup(false);
            }}
          />
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <div>Updating location data...</div>
          </div>
        </div>
      )}

      <div className="flex space-x-2 mb-4">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          onClick={() => setEditMode(false)}
        >
          Normal Mode
        </button>
        <button
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          onClick={() => setEditMode(true)}
        >
          Edit Mode
        </button>

        {/* Preview Button and it will be appear in the edit mode only */}
        {editMode && (
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            onClick={handlePreview}
          >
            Preview Changes
          </button>
        )}
        {editMode && (
          <button
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            onClick={() => {
              handleSave();
            }}
          >
            SAVE
          </button>
        )}
      </div>

      {editMode && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
          <p className="font-medium">Edit Mode Instructions:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>Drag markers to new locations to update them</li>
            <li>
              Marker details will automatically update with new location
              information
            </li>
            <li>
              Click "Preview Changes" to review your changes before saving
            </li>
            <li>Click "SAVE" to permanently save your changes</li>
          </ul>
        </div>
      )}

      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "800px",
          borderRadius: "8px",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        }}
      />
    </div>
  );
}
