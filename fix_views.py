import os

file_path = r'c:\Users\husna\Music\Dapp\quality_check_project\qc\views.py'

with open(file_path, 'r') as f:
    lines = f.readlines()

# Find indices of "class FilterPresetViewSet"
indices = [i for i, line in enumerate(lines) if "class FilterPresetViewSet(viewsets.ModelViewSet):" in line]

if len(indices) >= 2:
    start_cut = indices[0]
    end_cut = indices[1]
    
    print(f"Found duplicates at lines {start_cut+1} and {end_cut+1}")
    
    # Keep lines before the first occurrence and lines from the second occurrence onwards
    new_lines = lines[:start_cut] + lines[end_cut:]
    
    with open(file_path, 'w') as f:
        f.writelines(new_lines)
    print("Successfully removed duplicated block.")
else:
    print("Did not find two occurrences of FilterPresetViewSet. No changes made.")
