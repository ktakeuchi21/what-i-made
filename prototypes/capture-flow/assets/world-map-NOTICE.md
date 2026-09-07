# World map data notice

`world-map-data.js` is generated from Natural Earth `ne_110m_admin_0_countries`, downloaded from the official `nvkelso/natural-earth-vector` repository on September 5, 2026:

https://github.com/nvkelso/natural-earth-vector

Natural Earth data is public domain and free for any type of project:

https://www.naturalearthdata.com/about/terms-of-use/

The local generator applies the Natural Earth projection, rounds output coordinates, and preserves Natural Earth country names, aliases, ISO identifiers, and label points. Regenerate with:

```sh
python3 scripts/generate-world-map.py ne_110m_admin_0_countries.geojson assets/world-map-data.js
```
