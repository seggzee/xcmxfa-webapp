README.dev.md

XCM / XFA WebApp -- Development & Deployment Guide**

==========================================================================

----------------------
Architecture Overview
----------------------

Frontend

-   React + TypeScript
-   Vite build system
-   Dev server: `npm run dev`
-   Production output: `/dist`

Backend

-   PHP
-   https://apps-backend.34deltax.com
-   CORS handled via `_cors.php`

Hosting

-   Synology (Nginx)
-   Frontend: https://webapp.34deltax.com
-   Backend: https://apps-backend.34deltax.com
-   SSL: \*.34deltax.com

==========================================================================

---------------------------
FOLDER STRUCTURE (CRITICAL)
----------------------------

?? Workspace (Source Code – NEVER served)

Example:

D:\CloudStation\projects\webapp-xcmxfa-src\
  src\
  node_modules\
  dist\          (generated)
  package.json
  tsconfig*.json
  vite.config.ts
  .env*


This is where all development happens.

==========================================================================

---------------------------------------------
DEPLOY FOLDER (WEBROOT – ONLY BUILD OUTPUT)
----------------------------------------------

Example:

D:\CloudStation\synology-webroots\webapp.34deltax.com\
  index.html
  assets\


This folder contains ONLY the contents of /dist.

? Never edit files here
? Never copy src/
? Never copy node_modules/

==========================================================================

----------------------
DEVELOPMENT WORKFLOW
---------------------

?? Local Development (Hot Reload)

Used for:

Styling

Layout

Feature development

Fast iteration

D:
cd CloudStation\projects\webapp-xcmxfa-src
npm install
npm run dev


Runs:

http://localhost:5173


Hot reload enabled

Uses .env.development

Does NOT create dist

==========================================================================

PRODUCTION / STAGING BUILD WORKFLOW

---------------------
STEP 1 – BUILD:
----------------------
D:
cd CloudStation\projects\webapp-xcmxfa-src
npm install
set VITE_API_BASE_URL=https://apps-backend.34deltax.com
npm run build


Creates:

dist/
  index.html
  assets/

-----------------------------------------------------
STEP 2 – OPTIONAL: PREVIEW PRODUCTION BUILD LOCALLY:
-----------------------------------------------------
npm run preview


Serves built files (no hot reload).

--------------------------------
STEP 3 – DEPLOY TO SYNOLOGY:
--------------------------------

Copy contents of dist, not the folder itself:

robocopy "D:\CloudStation\projects\webapp-xcmxfa-src\dist" ^
         "D:\CloudStation\synology-webroots\webapp.34deltax.com" ^
         /MIR


After sync:

webapp.34deltax.com/
  index.html
  assets/

=============================================================================

------------------------
ENVIRONMENT VARIABLES:
-----------------------
.env.development

Used by:

npm run dev

.env.production

Used by:

npm run build


Must include:

VITE_API_BASE_URL=https://apps-backend.34deltax.com
=============================================================================

----------------
CORS OVERVIEW:
---------------

Backend _cors.php:

Reflects allowed origins

Handles OPTIONS preflight

Must be included at top of every public endpoint

Login failures showing CORS errors may actually be 404s

===========================================================================

-----------------------
RECOVERY PLAYBOOK:
----------------------

Recovery Playbook (When Things Act Weird)

?? Reset dependencies
rmdir /s /q node_modules
npm install

?? Rebuild
npm run build

?? Redeploy
robocopy dist ? webroot /MIR

?? Hard refresh browser

Ctrl + Shift + R

===========================================================================

Golden Rules

-   Never deploy src/
-   Never deploy node_modules/
-   Never edit webroot directly
-   dist is the product
-   If confused â†’ rebuild clean

===========================================================================
 
ONE-PAGE QUICK COMMAND GUIDE
------------------------------



---------------------
START LOCAL DEV:
---------------------

D:
cd CloudStation\projects\webapp-xcmxfa-src
npm run dev



-------------------------
BUILD FOR PRODUCTION:
-------------------------

D:
cd CloudStation\projects\webapp-xcmxfa-src
set VITE_API_BASE_URL=https://apps-backend.34deltax.com
npm run build



--------------------------
PREVIEW PRODUCTION BUILD:
--------------------------
npm run preview



--------------------
DEPLOY TO SYNOLOGY:
---------------------

robocopy "D:\CloudStation\projects\webapp-xcmxfa-src\dist" 
         "D:\CloudStation\synology-webroots\webapp.34deltax.com" 
         /MIR

		 
--------------------
RESET DEPENDENCIES:
--------------------

rmdir /s /q node_modules
npm install

===========================================================================