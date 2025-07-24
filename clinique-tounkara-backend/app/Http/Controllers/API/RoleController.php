<?php
    namespace App\Http\Controllers\API;

    use App\Http\Controllers\Controller;
    use App\Models\Role;
    use App\Models\Permission;
    use Illuminate\Http\Request;

    class RoleController extends Controller
    {
    public function index()
    {
    $roles = Role::with('permissions')->get();
    return response()->json($roles);
    }

        public function store(Request $request)
        {
            $request->validate([
                'name' => 'required|string|unique:roles,name',
                'permissions' => 'required|array',
                'permissions.*.name' => 'required|string|exists:permissions,name',
                'permissions.*.description' => 'nullable|string'
            ]);

            $role = Role::create(['name' => $request->name]);

            // Récupérer les IDs des permissions via leur nom
            $permissionIds = Permission::whereIn('name', collect($request->permissions)->pluck('name'))->pluck('id');

            $role->permissions()->sync($permissionIds);

            return response()->json($role->load('permissions'), 201);
        }


        public function update(Request $request, Role $role)
        {
            $request->validate([
                'name' => 'sometimes|required|string|unique:roles,name,' . $role->id,
                'permissions' => 'sometimes|array',
                'permissions.*.name' => 'required|string|exists:permissions,name',
                'permissions.*.description' => 'nullable|string'
            ]);

            $role->update(['name' => $request->name]);

            if ($request->has('permissions')) {
                $permissionIds = Permission::whereIn('name', collect($request->permissions)->pluck('name'))->pluck('id');
                $role->permissions()->sync($permissionIds);
            }

            return response()->json($role->load('permissions'));
        }


        public function destroy(Role $role)
    {
    $role->permissions()->detach();
    $role->delete();
    return response()->json(['message' => 'Rôle supprimé']);
    }
    }
