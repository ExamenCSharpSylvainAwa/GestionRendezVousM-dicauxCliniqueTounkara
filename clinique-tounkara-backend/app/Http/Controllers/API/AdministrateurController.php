<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Administrateur;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\Request;

class AdministrateurController extends Controller
{
    public function index()
    {
        $administrateurs = Administrateur::with('user')->paginate(10);
        return response()->json($administrateurs);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'niveau' => 'required|string',
            'permissions' => 'required|json',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $administrateur = Administrateur::create($request->all());
        return response()->json($administrateur->load('user'), 201);
    }

    public function show(Administrateur $administrateur)
    {
        return response()->json($administrateur->load('user', 'rapports'));
    }

    public function update(Request $request, Administrateur $administrateur)
    {
        $validator = Validator::make($request->all(), [
            'niveau' => 'sometimes|required|string',
            'permissions' => 'sometimes|required|json',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $administrateur->update($request->all());
        return response()->json($administrateur->load('user'));
    }

    public function destroy(Administrateur $administrateur)
    {
        $administrateur->delete();
        return response()->json(['message' => 'Administrateur supprimé avec succès']);
    }
}
