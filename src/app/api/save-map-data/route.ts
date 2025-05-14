/* eslint-disable @typescript-eslint/no-explicit-any */
import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const { markers, interconnects } = await request.json();
    console.log("Received data:", { markers, interconnects });

    if (!markers || !interconnects) {
      throw new Error("Invalid data: markers and interconnects are required");
    }

    // Paths to JSON files
    const markersFilePath = path.join(
      process.cwd(),
      "src",
      "data",
      "SiteMarkers.json"
    );
    const interconnectsFilePath = path.join(
      process.cwd(),
      "src",
      "data",
      "InterConnectSegments.json"
    );

    // Backup the current files before modifying
    try {
      const currentMarkers = await fs.readFile(markersFilePath, "utf8");
      const currentInterconnects = await fs.readFile(
        interconnectsFilePath,
        "utf8"
      );

      await fs.writeFile(
        path.join(process.cwd(), "src", "data", "SiteMarkers_backup.json"),
        currentMarkers,
        "utf8"
      );

      await fs.writeFile(
        path.join(
          process.cwd(),
          "src",
          "data",
          "InterConnectSegments_backup.json"
        ),
        currentInterconnects,
        "utf8"
      );

      console.log("Backup files created successfully");
    } catch (backupError) {
      console.warn("Could not create backup files:", backupError);
      // Continue with the save operation even if backup fails
    }

    // Load previous markers to detect renames
    let previousMarkers = [];
    try {
      previousMarkers = JSON.parse(await fs.readFile(markersFilePath, "utf8"));
    } catch (e) {
      // If file doesn't exist or can't be read, treat as empty
      console.log(e);
      previousMarkers = [];
    }

    // Build a map of oldName -> newName for renamed markers
    const oldToNewNameMap = new Map();
    previousMarkers.forEach((oldMarker: any) => {
      // Try to find a marker with the same LatLng (or other unique property)
      const newMarker = markers.find(
        (m: any) => m.LatLng === oldMarker.LatLng && m.Name !== oldMarker.Name
      );
      if (newMarker) {
        oldToNewNameMap.set(oldMarker.Name, newMarker.Name);
      }
    });

    // Update all interconnectors' Source and Target fields if the marker was renamed
    const updatedInterconnects = interconnects.map((ic: any) => {
      let newSource = ic.Source;
      let newTarget = ic.Target;
      if (oldToNewNameMap.has(ic.Source)) {
        newSource = oldToNewNameMap.get(ic.Source);
      }
      if (oldToNewNameMap.has(ic.Target)) {
        newTarget = oldToNewNameMap.get(ic.Target);
      }
      return {
        ...ic,
        Source: newSource,
        Target: newTarget,
        Update: "1",
      };
    });

    // Prepare the markers for saving, ensuring Address is properly formatted
    const finalMarkers = markers.map((marker: any) => {
      // Ensure Address is properly formatted
      let formattedAddress = marker.Address;

      // If Address is a string that looks like an object but isn't properly formatted JSON
      if (
        typeof marker.Address === "string" &&
        (marker.Address.includes("Address:") ||
          marker.Address.includes("City:") ||
          marker.Address.includes("Country:"))
      ) {
        try {
          // Try to parse it as JSON
          JSON.parse(marker.Address);
        } catch (e) {
          // If it fails, format it properly
          console.log("Reformatting address for marker:", marker.Name);
          const addressParts = marker.Address.split(/\\n|,/);
          const addressObj = {
            Address: "",
            City: "",
            State: "",
            ZIP: "",
            Country: "",
          };

          addressParts.forEach((part: string) => {
            if (part.includes("Address:"))
              addressObj.Address = part.replace("Address:", "").trim();
            if (part.includes("City:"))
              addressObj.City = part.replace("City:", "").trim();
            if (part.includes("State:"))
              addressObj.State = part.replace("State:", "").trim();
            if (part.includes("ZIP:"))
              addressObj.ZIP = part.replace("ZIP:", "").trim();
            if (part.includes("Country:"))
              addressObj.Country = part.replace("Country:", "").trim();
          });

          formattedAddress = JSON.stringify(addressObj);
        }
      }

      return {
        ...marker,
        Address: formattedAddress,
        Update: "1", // Always set Update to "1" for saved markers
      };
    });

    // Write the files
    try {
      // Write markers
      await fs.writeFile(
        markersFilePath,
        JSON.stringify(finalMarkers, null, 2),
        { encoding: "utf8", flag: "w" }
      );

      // Write interconnects
      await fs.writeFile(
        interconnectsFilePath,
        JSON.stringify(updatedInterconnects, null, 2),
        {
          encoding: "utf8",
          flag: "w",
        }
      );

      // Verify the writes
      const verifyMarkers = JSON.parse(
        await fs.readFile(markersFilePath, "utf8")
      );
      const verifyInterconnects = JSON.parse(
        await fs.readFile(interconnectsFilePath, "utf8")
      );

      if (
        verifyMarkers.length !== finalMarkers.length ||
        verifyInterconnects.length !== updatedInterconnects.length
      ) {
        throw new Error(
          "Verification failed: File content mismatch after save"
        );
      }

      console.log("Files written and verified successfully");

      return NextResponse.json(
        {
          message: "Data saved successfully",
          markers: finalMarkers,
          interconnects: updatedInterconnects,
        },
        { status: 200 }
      );
    } catch (writeError) {
      console.error("Error writing files:", writeError);
      throw writeError;
    }
  } catch (error) {
    console.error("Error in save operation:", error);
    return NextResponse.json(
      {
        message: "Failed to save data",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
