<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Medecin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class MedecinController extends Controller
{
    public function index()
    {
        $medecins = Medecin::with('user')->paginate(10);
        return response()->json($medecins);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'specialite' => 'required|string',
            'numero_ordre' => 'required|unique:medecins',
            'horaire_consultation' => 'required|json',
            'tarif_consultation' => 'required|numeric',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $medecin = Medecin::create($request->all());
        return response()->json($medecin->load('user'), 201);
    }

    public function show(Medecin $medecin)
    {
        return response()->json($medecin->load('user', 'rendezVous'));
    }

    public function update(Request $request, Medecin $medecin)
    {
        $validator = Validator::make($request->all(), [
            'specialite' => 'sometimes|required|string',
            'horaire_consultation' => 'sometimes|required|json',
            'tarif_consultation' => 'sometimes|required|numeric',
            'disponible' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $medecin->update($request->all());
        return response()->json($medecin->load('user'));
    }

    public function destroy(Medecin $medecin)
    {
        $medecin->delete();
        return response()->json(['message' => 'Médecin supprimé avec succès']);
    }
}
