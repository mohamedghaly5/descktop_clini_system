import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Calendar as CalendarIcon, Download } from "lucide-react";
import { format } from "date-fns";
import html2pdf from 'html2pdf.js';
import { db } from "@/services/db";

interface StockMovement {
    id: number;
    item_name: string;
    change: number;
    reason: string;
    created_at: string;
}

export const StockReportDialog = ({ disabled }: { disabled?: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [loading, setLoading] = useState(false);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const data = await db.stock.getMovements(startDate, endDate);
            setMovements(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchReport();
    }, [isOpen]);

    const handleExportPdf = () => {
        const element = document.getElementById('stock-report-content');
        const opt = {
            margin: 10,
            filename: `stock-report-${startDate}-to-${endDate}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        // @ts-ignore
        html2pdf().set(opt).from(element).save();
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={disabled}>
                    <FileText className="h-4 w-4" />
                    تقرير حركة المخزن
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>تقرير حركة المخزن</DialogTitle>
                </DialogHeader>

                <div className="flex gap-4 items-end mb-4 print:hidden">
                    <div className="grid gap-2">
                        <Label>من تاريخ</Label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>إلى تاريخ</Label>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <Button onClick={fetchReport} disabled={loading}>
                        {loading ? 'جاري التحميل...' : 'عرض التقرير'}
                    </Button>
                    <Button variant="secondary" onClick={handleExportPdf} className="mr-auto">
                        <Download className="h-4 w-4 mr-2" />
                        تصدير PDF
                    </Button>
                </div>

                <div id="stock-report-content" className="space-y-6 p-4 border rounded-lg bg-white">
                    <div className="text-center border-b pb-4 mb-4">
                        <h2 className="text-2xl font-bold">تقرير حركة المخزن</h2>
                        <p className="text-muted-foreground mt-1">
                            الفترة من {startDate} إلى {endDate}
                        </p>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right">التاريخ</TableHead>
                                <TableHead className="text-right">الصنف</TableHead>
                                <TableHead className="text-center">الكمية</TableHead>
                                <TableHead className="text-right">السبب / الملاحظات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {movements.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">
                                        لا توجد حركات خلال هذه الفترة
                                    </TableCell>
                                </TableRow>
                            ) : (
                                movements.map((mov) => (
                                    <TableRow key={mov.id}>
                                        <TableCell>{new Date(mov.created_at).toLocaleString('ar-EG')}</TableCell>
                                        <TableCell className="font-medium">{mov.item_name}</TableCell>
                                        <TableCell className="text-center" dir="ltr">
                                            <span className={mov.change < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                                                {mov.change > 0 ? '+' : ''}{mov.change}
                                            </span>
                                        </TableCell>
                                        <TableCell>{mov.reason || '-'}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
};
