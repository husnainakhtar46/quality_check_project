#!/usr/bin/env python3
"""
Script to update FinalInspections.tsx mobile spacing
"""

import os

# Path to the file
file_path = r'c:\Users\husna\Music\Dapp\quality_check_project\frontend\src\pages\FinalInspections.tsx'

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make the replacement
old_line = '    <div className="space-y-6">'
new_line = '    <div className="space-y-4 md:space-y-6 pb-10">'

if old_line in content:
    content = content.replace(old_line, new_line)
    print(f"✓ Replaced: {old_line.strip()}")
    print(f"  With:     {new_line.strip()}")
    
    # Write the file back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\n✓ Successfully updated {os.path.basename(file_path)}")
else:
    print(f"✗ Could not find the target line in {os.path.basename(file_path)}")
    print("The file may have already been updated or the content has changed.")
