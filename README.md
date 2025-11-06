# Plants vs Brainrots - Live Stock Tracker

This is a web application that displays live in-game information for "Plants vs Brainrots," including the current weather and items available in the Seed and Gear shops. The UI is designed to be clean, modern, and responsive.

## Features

-   **Live Weather:** Shows the current in-game weather status.
-   **Live Shop Stock:** Displays the current items and quantities in the Seed and Gear shops.
-   **Countdown Timer:** Indicates when the next shop stock rotation will occur.
-   **Modern UI:** A sleek, responsive user interface inspired by modern web design.
-   **Light/Dark Theme:** Switch between light and dark modes to suit your preference.
-   **Auto-Refreshes:** The data automatically updates at regular intervals.

## How to Use

Simply open the `index.html` file in your web browser. The application will automatically fetch and display the latest information.

## Project Structure

-   `index.html`: The main HTML file for the website.
-   `styles.css`: Contains all the CSS styling for the application.
-   `script.js`: The JavaScript file that handles API data fetching, dynamic content updates, and user interface interactions.
-   `README.md`: This file, providing an overview of the project.
-   `manifest.json`: The manifest file for PWA (Progressive Web App) functionality.

## API Endpoints

The application fetches data from the following public API endpoints:

-   **Weather:** `https://plantsvsbrainrot.com/api/weather.php`
-   **Shop Data:** `https://plantsvsbrainrot.com/api/seed-shop.php`

## Technologies Used

-   HTML5
-   CSS3 (with custom properties for theming)
-   JavaScript (ES6+)
-   Font Awesome for icons
-   Google Fonts for typography

## Mobile Version

The website is fully responsive and designed to work well on mobile devices, tablets, and desktops. The layout adjusts to different screen sizes to ensure a great user experience on any device.