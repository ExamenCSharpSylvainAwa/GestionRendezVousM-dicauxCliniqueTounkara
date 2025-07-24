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
        $consultations = Consultation::with('dossierMedical.patient.user')->paginate(10);
        return response()->json([
            'data' => $consultations->items(),
            'current_page' => $consultations->currentPage(),
            'last_page' => $consultations->lastPage(),
            'per_page' => $consultations->perPage(),
            'total' => $consultations->total(),
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'dossier_medical_id' => 'required|exists:dossier_medicals,id',
            'date' => 'required|date',
            'symptomes' => 'required|string',
            'diagnostic' => 'required|string',
            'recommandations' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $consultation = Consultation::create($request->all());
        $consultation->load('dossierMedical.patient.user');
        return response()->json($consultation, 201);
    }

    public function show(Consultation $consultation)
    {
        $consultation->load('dossierMedical.patient.user');
        return response()->json($consultation);
    }

    public function update(Request $request, Consultation $consultation)
    {
        $validator = Validator::make($request->all(), [
            'dossier_medical_id' => 'sometimes|required|exists:dossier_medicals,id',
            'date' => 'sometimes|required|date',
            'symptomes' => 'sometimes|required|string',
            'diagnostic' => 'sometimes|required|string',
            'recommandations' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $consultation->update($request->all());
        $consultation->load('dossierMedical.patient.user');
        return response()->json($consultation);
    }

    public function destroy(Consultation $consultation)
    {
        $consultation->delete();
        return response()->json(['message' => 'Consultation supprimée avec succès']);
    }
}
