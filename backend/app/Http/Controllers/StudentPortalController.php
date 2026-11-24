<?php

namespace App\Http\Controllers;

use App\Models\ArtworkSale;
use App\Models\Invoice;
use App\Models\StudentCourseEnrollment;
use App\Models\StudentFee;
use App\Models\StudioMembership;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentPortalController extends Controller
{
    public function dashboard(Request $request): array
    {
        $student = $request->user();
        $fees = $this->fees($request);
        $sales = $this->sales($request);

        return [
            'profile' => ['id' => (string) $student->id] + $student->only(['name', 'email', 'username']),
            'courses' => StudentCourseEnrollment::where('user_id', $student->id)->orderBy('id')->pluck('name'),
            'membership' => StudioMembership::where('user_id', $student->id)->orderByDesc('expires_on')
                ->first(['name', 'expires_on'])?->only(['name', 'expires_on']),
            'outstanding' => $fees['outstanding'],
            'totalPaid' => round(collect($fees['paymentHistory'])->sum('amount'), 2),
            'earnings' => $sales['earnings'],
        ];
    }

    public function fees(Request $request): array
    {
        $fees = $this->ownedFees($request)->with('invoice.payment')->orderBy('due_date')->orderBy('id')
            ->get()->map(function (StudentFee $fee) {
                $invoice = $fee->invoice ? $this->invoiceData($fee, $fee->invoice) : null;
                $amount = $invoice['amount'] ?? $fee->amount_minor / 100;

                return [
                    'id' => (string) $fee->id,
                    'label' => $fee->label,
                    'type' => $fee->type,
                    'dueDate' => $fee->due_date,
                    'amount' => $amount,
                    'balance' => ($invoice['paidOn'] ?? null) ? 0 : $amount,
                    'status' => $invoice['status'] ?? 'Not invoiced',
                    'invoice' => $invoice,
                ];
            });

        return [
            'fees' => $fees->all(),
            'outstanding' => round($fees->sum('balance'), 2),
            'paymentHistory' => $fees->pluck('invoice')->filter(fn ($invoice) => $invoice && $invoice['paidOn'])
                ->sortByDesc('paidOn')->values()->all(),
        ];
    }

    public function invoices(Request $request): array
    {
        return collect($this->fees($request)['fees'])->pluck('invoice')->filter()->values()->all();
    }

    public function invoice(Request $request, int $id): array
    {
        $fee = $this->ownedFees($request)->whereHas('invoice', fn (Builder $query) => $query->whereKey($id))
            ->with('invoice.payment')->firstOrFail();

        return $this->invoiceData($fee, $fee->invoice);
    }

    public function createInvoice(Request $request)
    {
        $input = $request->validate(['feeId' => ['required', 'integer', 'min:1']]);
        [$data, $created] = DB::transaction(function () use ($request, $input) {
            $fee = $this->ownedFees($request)->lockForUpdate()->findOrFail($input['feeId']);
            $invoice = $fee->invoice()->firstOrCreate([], [
                'issued_on' => today()->toDateString(),
                'amount_minor' => $fee->amount_minor,
            ]);

            return [$this->invoiceData($fee, $invoice), $invoice->wasRecentlyCreated];
        }, 3);

        return response()->json($data, $created ? 201 : 200);
    }

    public function pay(Request $request, int $id): array
    {
        return DB::transaction(function () use ($request, $id) {
            $fee = $this->ownedFees($request)->whereHas('invoice', fn (Builder $query) => $query->whereKey($id))
                ->lockForUpdate()->firstOrFail();
            $invoice = $fee->invoice()->whereKey($id)->firstOrFail();
            $invoice->payment()->firstOrCreate([], [
                'paid_on' => today()->toDateString(),
                'amount_minor' => $invoice->amount_minor,
            ]);

            return $this->invoiceData($fee, $invoice);
        }, 3);
    }

    public function sales(Request $request): array
    {
        $sales = ArtworkSale::where('user_id', $request->user()->id)->orderByDesc('sold_on')->orderByDesc('id')
            ->get()->map(function (ArtworkSale $sale) {
                $rate = config('artspace.commission_percent');
                $commission = intdiv($sale->price_minor * $rate + 50, 100);

                return [
                    'id' => (string) $sale->id,
                    'artworkId' => $sale->artwork_id,
                    'artworkTitle' => $sale->artwork_title,
                    'soldOn' => $sale->sold_on,
                    'price' => $sale->price_minor / 100,
                    'commissionRate' => $rate / 100,
                    'commission' => $commission / 100,
                    'earnings' => ($sale->price_minor - $commission) / 100,
                    'paidOn' => $sale->paid_on,
                    'payoutStatus' => $sale->paid_on ? 'Paid' : 'Pending',
                ];
            });

        return ['sales' => $sales->all(), 'earnings' => round($sales->sum('earnings'), 2)];
    }

    private function ownedFees(Request $request): Builder
    {
        return StudentFee::where('user_id', $request->user()->id);
    }

    private function invoiceData(StudentFee $fee, Invoice $invoice): array
    {
        return [
            'id' => (string) $invoice->id,
            'feeId' => (string) $fee->id,
            'label' => $fee->label,
            'type' => $fee->type,
            'dueDate' => $fee->due_date,
            'amount' => $invoice->amount_minor / 100,
            'issuedOn' => $invoice->issued_on,
            'paidOn' => $invoice->payment?->paid_on,
            'status' => $invoice->payment ? 'Paid' : 'Unpaid',
        ];
    }
}
