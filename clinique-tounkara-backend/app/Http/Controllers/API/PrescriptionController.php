<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Prescription;
use Illuminate\Support\Facades\Validator;

class PrescriptionController extends Controller
{
    public function index()
    {
        $prescriptions = Prescription::with('consultation.dossierMedical.patient.user')->paginate(10);
        return response()->json($prescriptions);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'consultation_id' => 'required|exists:consultations,id',
            'date_emission' => 'required|date',
            'date_expiration' => 'required|date|after:date_emission',
            'description' => 'required|string',
            'medicaments' => 'required|json',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $prescription = Prescription::create($request->all());
        return response()->json($prescription->load('consultation.dossierMedical.patient.user'), 201);
    }

    public function show(Prescription $prescription)
    {
        return response()->json($prescription->load('consultation.dossierMedical.patient.user'));
    }

    public function update(Request $request, Prescription $prescription)
    {
        $validator = Validator::make($request->all(), [
            'date_emission' => 'sometimes|required|date',
            'date_expiration' => 'sometimes|required|date|after:date_emission',
            'description' => 'sometimes|required|string',
            'medicaments' => 'sometimes|required|json',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $prescription->update($request->all());
        return response()->json($prescription->load('consultation.dossierMedical.patient.user'));
    }

    public function destroy(Prescription $prescription)
    {
        $prescription->delete();
        return response()->json(['message' => 'Prescription supprimée avec succès']);
    }
}
