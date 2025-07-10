<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\DossierMedical;
use Illuminate\Support\Facades\Validator;

class DossierMedicalController extends Controller
{
    public function index()
    {
        $dossiers = DossierMedical::with('patient.user', 'consultations')->paginate(10);
        return response()->json($dossiers);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'patient_id' => 'required|exists:patients,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $dossier = DossierMedical::create($request->all());
        return response()->json($dossier->load('patient.user'), 201);
    }

    public function show(DossierMedical $dossierMedical)
    {
        return response()->json($dossierMedical->load('patient.user', 'consultations'));
    }

    public function update(Request $request, DossierMedical $dossierMedical)
    {
        $validator = Validator::make($request->all(), []);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $dossierMedical->update($request->all());
        return response()->json($dossierMedical->load('patient.user'));
    }

    public function destroy(DossierMedical $dossierMedical)
    {
        $dossierMedical->delete();
        return response()->json(['message' => 'Dossier médical supprimé avec succès']);
    }
}
