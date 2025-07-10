<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Consultation;
use Illuminate\Support\Facades\Validator;

class ConsultationController extends Controller
{
    public function index()
    {
        $rapports = Rapport::with('administrateur.user')->paginate(10);
        return response()->json($rapports);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'titre' => 'required|string',
            'date_generation' => 'required|date',
            'type' => 'required|string',
            'contenu' => 'required|string',
            'format' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $rapport = Rapport::create($request->all());
        return response()->json($rapport->load('administrateur.user'), 201);
    }

    public function show(Rapport $rapport)
    {
        return response()->json($rapport->load('administrateur.user'));
    }

    public function update(Request $request, Rapport $rapport)
    {
        $validator = Validator::make($request->all(), [
            'titre' => 'sometimes|required|string',
            'date_generation' => 'sometimes|required|date',
            'type' => 'sometimes|required|string',
            'contenu' => 'sometimes|required|string',
            'format' => 'sometimes|required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $rapport->update($request->all());
        return response()->json($rapport->load('administrateur.user'));
    }

    public function destroy(Rapport $rapport)
    {
        $rapport->delete();
        return response()->json(['message' => 'Rapport supprimé avec succès']);
    }
}
