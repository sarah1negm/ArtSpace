# ArtSpace Local

In the Bruno sidebar in VS Code, choose **Open Collection**, select this folder, and choose **Local** in the environment dropdown. Use a collection without authenticated cookies for the dashboard smoke test.

Run Health for HTTP 200, Public catalogue for HTTP 200 with a JSON array, and Student dashboard without login for HTTP 401. These checks use the Laravel server on port 8000. An empty catalogue is valid. Authenticated student requests require the team's Laravel login and a student session.
