# bird-brdf-viewer
A BRDF viewer for the JSON universal BRDF data format from the Bird project.

The Bird BRDF viewer is a web application that aims to display BRDF data formatted 
in the JSON format devised by the BiRD project https://www.birdproject.eu/

It lives as an alternative to BiRD view https://github.com/BiRD-project/BiRD_view
mostly because it was slow and would not handle my files and seems to not be supported by anyone anymore.

For the moment the functionnalities it supports are very limited (no polarization, no fluorescence, ...)
but if you have dense spectral BRDF, it should work.


## TODOS
- wrap everything inside a class