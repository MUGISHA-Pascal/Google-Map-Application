"use client";

import type { SiteMarker, InterConnectSegment } from "@/types";
import type React from "react";
import { useState } from "react";
import { useGeocode } from "@/hooks/useGeocode";

interface PopupDataViewProps {
  markers: SiteMarker[];
  interconnects: InterConnectSegment[];
  previousMarkers: SiteMarker[];
  onClose: () => void;
  onSave?: () => void;
}

const MarkerCard: React.FC<{
  marker: SiteMarker;
  previousState?: SiteMarker;
  index: number;
}> = ({ marker, previousState, index }) => {
  const { data: currentData, loading: currentLoading } = useGeocode(
    marker.LatLng
  );
  const { data: previousData, loading: previousLoading } = useGeocode(
    previousState?.LatLng || ""
  );
  const hasChanges = previousState && previousState.LatLng !== marker.LatLng;

  return (
    <div
      className="border border-gray-200 rounded-lg overflow-hidden transition-all hover:shadow-md bg-white"
      style={{ height: "100%" }}
    >
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h4 className="m-0 text-base font-semibold text-gray-800 flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: marker.iconColor || "#0d6efd" }}
          ></span>
          {marker.Name || `Marker ${index + 1}`}
        </h4>
        {hasChanges && (
          <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
            Modified
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">Location</div>
          <div className="text-sm p-2 bg-gray-50 rounded-md">
            {hasChanges ? (
              <div>
                <div className="text-red-600 mb-2">
                  <div className="font-medium mb-1">Previous Location:</div>
                  <div className="ml-3 mt-1">
                    {previousLoading ? (
                      <div className="text-gray-500">Loading address...</div>
                    ) : previousData ? (
                      <>
                        <div className="mb-0.5">
                          Country: {previousData.country}
                        </div>
                        <div className="mb-0.5">City: {previousData.city}</div>
                        {previousData.street && (
                          <div className="mb-0.5">
                            Address: {previousData.street}
                          </div>
                        )}
                        <div className="mt-1 text-gray-500 font-mono text-xs">
                          Coordinates: {previousState?.LatLng}
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-500 font-mono text-xs">
                        Coordinates: {previousState?.LatLng}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-green-600">
                  <div className="font-medium mb-1">Current Location:</div>
                  <div className="ml-3 mt-1">
                    {currentLoading ? (
                      <div className="text-gray-500">Loading address...</div>
                    ) : currentData ? (
                      <>
                        <div className="mb-0.5">
                          Country: {currentData.country}
                        </div>
                        <div className="mb-0.5">City: {currentData.city}</div>
                        {currentData.street && (
                          <div className="mb-0.5">
                            Address: {currentData.street}
                          </div>
                        )}
                        {currentData.state && (
                          <div className="mb-0.5">
                            State/Region: {currentData.state}
                          </div>
                        )}
                        {currentData.postalCode && (
                          <div className="mb-0.5">
                            Postal Code: {currentData.postalCode}
                          </div>
                        )}
                        <div className="mt-1 text-gray-500 font-mono text-xs">
                          Coordinates: {marker.LatLng}
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-500 font-mono text-xs">
                        Coordinates: {marker.LatLng}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {currentLoading ? (
                  <div className="text-gray-500">Loading address...</div>
                ) : currentData ? (
                  <>
                    <div className="mb-0.5">Country: {currentData.country}</div>
                    <div className="mb-0.5">City: {currentData.city}</div>
                    {currentData.street && (
                      <div className="mb-0.5">
                        Address: {currentData.street}
                      </div>
                    )}
                    {currentData.state && (
                      <div className="mb-0.5">
                        State/Region: {currentData.state}
                      </div>
                    )}
                    {currentData.postalCode && (
                      <div className="mb-0.5">
                        Postal Code: {currentData.postalCode}
                      </div>
                    )}
                    <div className="mt-1 text-gray-500 font-mono text-xs">
                      Coordinates: {marker.LatLng}
                    </div>
                  </>
                ) : (
                  <div className="text-gray-500 font-mono text-xs">
                    Coordinates: {marker.LatLng}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {marker.tooltip && (
          <div className="mb-4">
            <div className="text-sm text-gray-500 mb-1">Tooltip</div>
            <div className="text-sm bg-gray-50 p-2 rounded-md whitespace-pre-wrap">
              {marker.tooltip.replace(/\\n/g, "\n")}
            </div>
          </div>
        )}

        {marker.Details && (
          <div className="mb-4">
            <div className="text-sm text-gray-500 mb-1">Details</div>
            <div className="text-sm bg-gray-50 p-2 rounded-md whitespace-pre-wrap">
              {marker.Details.replace(/\\n/g, "\n")}
            </div>
          </div>
        )}

        {marker.Address && typeof marker.Address === "string" && (
          <div>
            <div className="text-sm text-gray-500 mb-1">Address Data</div>
            <div className="text-sm bg-gray-50 p-2 rounded-md overflow-auto max-h-32 font-mono text-xs">
              {marker.Address}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InterconnectCard: React.FC<{
  interconnect: InterConnectSegment;
  index: number;
  markers: SiteMarker[];
}> = ({ interconnect, index, markers }) => {
  // Find source and target markers to display their locations
  const sourceMarker = markers.find((m) => m.Name === interconnect.Source);
  const targetMarker = markers.find((m) => m.Name === interconnect.Target);

  return (
    <div
      className="border border-gray-200 rounded-lg overflow-hidden transition-all hover:shadow-md bg-white"
      style={{ height: "100%" }}
    >
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h4 className="m-0 text-base font-semibold text-gray-800">
          {interconnect.Name || `Interconnect ${index + 1}`}
        </h4>
        {interconnect.Update === "1" && (
          <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
            Modified
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">Connection</div>
          <div className="text-sm p-2 bg-gray-50 rounded-md flex items-center gap-2">
            <span className="font-medium">{interconnect.Source}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
            <span className="font-medium">{interconnect.Target}</span>
          </div>
        </div>

        {(sourceMarker || targetMarker) && (
          <div className="mb-4">
            <div className="text-sm text-gray-500 mb-1">Endpoints</div>
            <div className="text-sm p-2 bg-gray-50 rounded-md">
              {sourceMarker && (
                <div className="mb-2">
                  <div className="font-medium">
                    Source: {interconnect.Source}
                  </div>
                  <div className="ml-3 text-xs text-gray-600 mt-1">
                    Coordinates: {sourceMarker.LatLng}
                  </div>
                </div>
              )}
              {targetMarker && (
                <div>
                  <div className="font-medium">
                    Target: {interconnect.Target}
                  </div>
                  <div className="ml-3 text-xs text-gray-600 mt-1">
                    Coordinates: {targetMarker.LatLng}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">Line Style</div>
          <div className="text-sm p-2 bg-gray-50 rounded-md flex items-center gap-2">
            <span
              className="inline-block w-4 h-4 rounded"
              style={{ backgroundColor: interconnect.LineColor || "#000" }}
            ></span>
            <span>{interconnect.LineColor || "Default"}</span>
            <span className="mx-2">|</span>
            <span>{interconnect.LineWidthpx || "1"}px</span>
            <span className="mx-2">|</span>
            <span>{interconnect.LineType || "Solid"}</span>
          </div>
        </div>

        {interconnect.Desc && (
          <div className="mb-4">
            <div className="text-sm text-gray-500 mb-1">Description</div>
            <div className="text-sm p-2 bg-gray-50 rounded-md">
              {interconnect.Desc}
            </div>
          </div>
        )}

        {interconnect.WaypointLatLngArray && (
          <div>
            <div className="text-sm text-gray-500 mb-1">Waypoints</div>
            <div className="text-sm p-2 bg-gray-50 rounded-md font-mono text-xs overflow-auto max-h-24">
              {interconnect.WaypointLatLngArray}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DataPreview: React.FC<PopupDataViewProps> = ({
  markers,
  interconnects,
  previousMarkers,
  onClose,
  onSave,
}) => {
  const [dataType, setDataType] = useState<"markers" | "interconnects">(
    "markers"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterChanged, setFilterChanged] = useState(false);

  const getPreviousMarkerState = (markerName: string) => {
    return previousMarkers.find((m) => m.Name === markerName);
  };

  const filteredMarkers = markers.filter((marker) => {
    if (!searchQuery)
      return !filterChanged || getPreviousMarkerState(marker.Name);
    return marker.Name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredInterconnects = interconnects.filter((ic) => {
    if (!searchQuery) return !filterChanged || ic.Update === "1";
    return (
      ic.Name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ic.Source?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ic.Target?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-11/12 max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
          <h3 className="text-xl font-semibold text-gray-800">
            Preview Changes
          </h3>
          <div className="flex gap-3 items-center">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm w-64 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg
                className="absolute right-2 top-2.5 text-gray-400"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show-changed"
                checked={filterChanged}
                onChange={(e) => setFilterChanged(e.target.checked)}
                className="rounded text-blue-500 focus:ring-blue-500"
              />
              <label htmlFor="show-changed" className="text-sm text-gray-600">
                Show only changed items
              </label>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Close"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18"></path>
                <path d="m6 6 12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setDataType("markers")}
            className={`flex-1 py-3 px-4 text-center focus:outline-none ${
              dataType === "markers"
                ? "text-blue-600 font-medium border-b-2 border-blue-500 bg-white"
                : "text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100"
            }`}
          >
            Markers ({filteredMarkers.length})
          </button>
          <button
            onClick={() => setDataType("interconnects")}
            className={`flex-1 py-3 px-4 text-center focus:outline-none ${
              dataType === "interconnects"
                ? "text-blue-600 font-medium border-b-2 border-blue-500 bg-white"
                : "text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100"
            }`}
          >
            Interconnects ({filteredInterconnects.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-grow">
          {dataType === "markers" && filteredMarkers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No markers match your search criteria
            </div>
          )}

          {dataType === "interconnects" &&
            filteredInterconnects.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No interconnects match your search criteria
              </div>
            )}

          {dataType === "markers" && filteredMarkers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMarkers.map((marker, index) => (
                <MarkerCard
                  key={marker.Name || index}
                  marker={marker}
                  previousState={getPreviousMarkerState(marker.Name)}
                  index={index}
                />
              ))}
            </div>
          )}

          {dataType === "interconnects" && filteredInterconnects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInterconnects.map((interconnect, index) => (
                <InterconnectCard
                  key={`${interconnect.Source}-${interconnect.Target}-${index}`}
                  interconnect={interconnect}
                  index={index}
                  markers={markers}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataPreview;
