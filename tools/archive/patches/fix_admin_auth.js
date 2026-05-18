const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;

            // Tự động thêm dòng kiểm tra hydration trước khi kick user
            const regex = /if \(\!isAuthenticated \|\| \!hasPermission\(([^,]+),/g;
            if (regex.test(content)) {
                 content = content.replace(
                     /if \(\!isAuthenticated \|\| \!hasPermission\(([^,]+), ['`"]([^'"`]+)['`"]\)\) \{(\s*router\.push\(['`"].*?['`"]\);\s*return;\s*)\}/g,
                     (match, userVar, perm, action) => {
                         return `const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;\n        if (!_token && (!isAuthenticated || !hasPermission(${userVar}, '${perm}'))) {${action}}`;
                     }
                 );
            }

            if (content !== original) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed:', fullPath);
            }
        }
    }
}

processDir(path.join(__dirname, 'app', 'admin'));
