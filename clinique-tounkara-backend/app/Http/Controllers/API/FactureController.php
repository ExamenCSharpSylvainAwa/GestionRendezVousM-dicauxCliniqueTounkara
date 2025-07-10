<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Facture;
use App\Models\Paiement;
use Illuminate\Support\Facades\Validator;
use Barryvdh\DomPDF\Facade\Pdf;

class FactureController extends Controller
{
    public function index()
    {
        $factures = Facture::with('paiement.rendezVous.patient.user')->paginate(10);
        return response()->json($factures);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'paiement_id' => 'required|exists:paiements,id',
            'numero' => 'required|string|unique:factures',
            'date_emission' => 'required|date',
            'date_echeance' => 'required|date|after:date_emission',
            'montant_total' => 'required|numeric',
            'tva' => 'nullable|numeric',
            'statut' => 'required|in:brouillon,envoyee,payee',
            'details_facture' => 'required|json',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $facture = Facture::create($request->all());
        return response()->json($facture->load('paiement.rendezVous.patient.user'), 201);
    }

    public function show(Facture $facture)
    {
        return response()->json($facture->load('paiement.rendezVous.patient.user'));
    }

    public function update(Request $request, Facture $facture)
    {
        $validator = Validator::make($request->all(), [
            'date_emission' => 'sometimes|required|date',
            'date_echeance' => 'sometimes|required|date|after:date_emission',
            'montant_total' => 'sometimes|required|numeric',
            'tva' => 'nullable|numeric',
            'statut' => 'sometimes|in:brouillon,envoyee,payee',
            'details_facture' => 'sometimes|required|json',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $facture->update($request->all());
        return response()->json($facture->load('paiement.rendezVous.patient.user'));
    }

    public function destroy(Facture $facture)
    {
        $facture->delete();
        return response()->json(['message' => 'Facture supprimée avec succès']);
    }

    public function generatePDF(Facture $facture)
    {
        $pdf = Pdf::loadView('pdf.facture', compact('facture'));
        return $pdf->download('facture_' . $facture->numero . '.pdf');
    }
}
