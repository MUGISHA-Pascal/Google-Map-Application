# Google Map Application

A professional Google Maps integration built with Next.js, designed for visualizing and managing site markers and their interconnections.

## Features

- **Interactive Map Visualization**: Renders site markers and interconnect segments (polylines) using the Google Maps JavaScript API.
- **Advanced Edit Mode**:
  - **Draggable Markers**: Move markers in real-time to adjust their positions.
  - **Real-time Reverse Geocoding**: Automatically updates marker names and detailed addresses based on their new coordinates using Google's Geocoding API.
  - **Dynamic Path Updates**: Interconnected segments automatically adjust their endpoints when a connected marker is moved.
- **Data Management**:
  - **JSON Data Integration**: Loads marker and segment data from local JSON files.
  - **Data Preview**: Review all changes in a structured JSON preview before committing.
  - **Persistence**: Save updated map state back to the server via a dedicated API.
- **Export Capabilities**: Capture the current map view and markers as a PNG image.
- **Professional UI**: Built with Tailwind CSS for a clean, responsive experience.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Maps API**: [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/)
- **Libraries**: 
  - `@googlemaps/js-api-loader` for optimized API loading.
  - `html2canvas` for map image export.

## Getting Started

### Prerequisites

- Node.js 18+
- A Google Maps API Key with the following APIs enabled:
  - Maps JavaScript API
  - Geocoding API

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/MUGISHA-Pascal/Google-Map-Application.git
   cd Google-Map-Application
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env.local` file in the root directory and add your Google Maps API key:
   ```env
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Access the app**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

### Normal Mode
- **View**: Explore markers and segments.
- **Interact**: Click markers to see detailed location and address information in a professional popup.
- **Hover**: See quick location summaries via tooltips.

### Edit Mode
1. Click the **"Edit Mode"** button.
2. **Drag and Drop**: Move any marker on the map.
3. **Observe Updates**: Watch as the coordinates, addresses, and connected paths update automatically in real-time.
4. **Preview**: Click **"Preview Changes"** to see the modified JSON data.
5. **Save**: Click **"SAVE"** to persist the changes to the server.

## Project Structure

- `src/app/`: Next.js pages and API routes.
- `src/components/`: Reusable UI components (e.g., `GoogleMap`, `DataPreview`).
- `src/data/`: JSON data stores for site markers and interconnect segments.
- `src/app/utils/`: Helper functions for map loading and geocoding.
- `src/types/`: TypeScript definitions for markers and segments.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
