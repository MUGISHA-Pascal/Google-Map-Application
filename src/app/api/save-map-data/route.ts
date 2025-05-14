/* eslint-disable @typescript-eslint/no-explicit-any */
import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { markers, interconnects } = await request.json();
    console.log("Received data:", { markers, interconnects });

    if (!markers || !interconnects) {
      throw new Error("Invalid data: markers and interconnects are required");
    }

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

    // Format and clean markers
    const finalMarkers = markers.map((marker: any) => {
      let formattedAddress = marker.Address;

      if (
        typeof marker.Address === "string" &&
        (marker.Address.includes("Address:") ||
          marker.Address.includes("City:") ||
          marker.Address.includes("Country:"))
      ) {
        try {
          JSON.parse(marker.Address);
        } catch {
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
        Update: "1",
      };
    });

    const finalInterconnects = interconnects.map((ic: any) => ({
      ...ic,
      Update: "1",
    }));

    // Write new data to files (clearing old content)
    await fs.writeFile(markersFilePath, JSON.stringify(finalMarkers, null, 2), {
      encoding: "utf8",
      flag: "w", // Overwrites the file
    });

    await fs.writeFile(
      interconnectsFilePath,
      JSON.stringify(finalInterconnects, null, 2),
      {
        encoding: "utf8",
        flag: "w", // Overwrites the file
      }
    );

    console.log("Files cleared and data written successfully");

    return NextResponse.json(
      {
        message: "Data saved successfully (old data cleared)",
        markers: finalMarkers,
        interconnects: finalInterconnects,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error saving data:", error);
    return NextResponse.json(
      {
        message: "Failed to save data",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
