# Data bundles

Drop your generated bundle here as `renegade-platinum.json`.

It is the SAME shape your existing Python parser already emits:
  { "title", "formatted_sets", "poks", "moves", "move_replacements" }

Convert the old executable bundle once:
  node -e "global.backup_data=null; eval(require('fs').readFileSync('rp.js','utf8')); \
    require('fs').writeFileSync('renegade-platinum.json', JSON.stringify(backup_data))"
