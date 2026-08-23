import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate and download a Technical Track Inspection & Diagnostic Report
 */
export function generateInspectionPDF(inspection) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryDark = [15, 23, 42];  // Slate 900
  const accentBlue = [37, 99, 235];   // Blue 600
  const passGreen = [16, 185, 129];
  const alertRed = [225, 29, 72];
  const textDark = [30, 41, 59];

  // Top Header
  doc.setFillColor(...primaryDark);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setFillColor(...accentBlue);
  doc.rect(0, 28, 210, 1.5, 'F');

  // Header Titles
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('RAILVISION AI • TRACK DEFECT DIAGNOSTIC SYSTEM', 15, 12);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('Automated Railway Infrastructure Structural Health Monitoring', 15, 18);
  doc.text('Deep Learning & Explainable AI (Grad-CAM) Inspection Core', 15, 23);

  // Right Token Box
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(142, 5, 56, 18, 2, 2, 'F');
  doc.setTextColor(147, 197, 253);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DIAGNOSTIC REPORT ID', 145, 10);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.text(inspection.inspection_token || 'RV-TRK-2026', 145, 15);
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(inspection.timestamp || new Date().toISOString().slice(0, 10), 145, 20);

  // Document Title & Status
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryDark);
  doc.text('STRUCTURAL INTEGRITY DIAGNOSTIC SUMMARY', 15, 38);

  const isDefective = inspection.is_defective;
  const isUncertain = inspection.is_uncertain;
  const safety = inspection.safety_assessment || {};

  let statusBg = passGreen;
  let statusText = 'STRUCTURALLY SOUND — NO DEFECT DETECTED';
  if (isUncertain) {
    statusBg = [217, 119, 6];
    statusText = 'INCONCLUSIVE — CONFIDENCE BELOW THRESHOLD';
  } else if (isDefective) {
    statusBg = alertRed;
    statusText = `STRUCTURAL DEFECT DETECTED (${safety.severity_level || 'DEFECTIVE'})`;
  }

  doc.setFillColor(...statusBg);
  doc.roundedRect(15, 42, 180, 9.5, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, 105, 48.5, { align: 'center' });

  // Parameters Table
  const tableData = [
    ['Sample ID', inspection.inspection_token || 'N/A', 'Timestamp', inspection.timestamp || 'N/A'],
    ['Input Resolution', '224 x 224 x 3 RGB', 'Filename', inspection.filename || 'track_sample.jpg'],
    ['Model Architecture', 'EfficientNetV2-B0', 'Validation Accuracy', '81.36% (Phase 2 Fine-Tuned)'],
    ['Classification', isDefective ? 'DEFECTIVE' : (isUncertain ? 'UNCERTAIN' : 'HEALTHY / NOMINAL'), 'Model Confidence', `${inspection.confidence || 0}%`],
    ['Confidence Threshold', `${(inspection.confidence_threshold || 0.72) * 100}%`, 'Inference Latency', `${inspection.inference_latency_ms || 48} ms`],
  ];

  doc.autoTable({
    startY: 55,
    head: [['Parameter', 'Inspection Metric', 'Parameter', 'Inspection Metric']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryDark,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: textDark
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 15, right: 15 }
  });

  let currentY = doc.lastAutoTable.finalY + 8;

  // Assessment Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(15, currentY, 180, 36, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryDark);
  doc.text('SCIENTIFIC ASSESSMENT & ENGINEERING RECOMMENDATION', 20, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const assessText = doc.splitTextToSize(
    `Assessment: ${safety.scientific_assessment || 'Feature activation analysis indicates nominal surface geometry.'}`,
    170
  );
  doc.text(assessText, 20, currentY + 13);

  const recText = doc.splitTextToSize(
    `Recommendation: ${safety.engineering_recommendation || 'Standard scheduled monitoring cycle.'}`,
    170
  );
  doc.text(recText, 20, currentY + 25);

  currentY += 44;

  // Grad-CAM Section
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryDark);
  doc.text('EXPLAINABLE AI & GRAD-CAM LOCALIZATION METRICS', 15, currentY);

  const gradCamData = [
    ['Activation Layer', 'top_conv (EfficientNetV2-B0)', 'Spatial Resolution', '7 x 7 Feature Tensor (Bicubic 224x224)'],
    ['Heatmap Mean Activation Index', `${inspection.heatmap_intensity || 0.35} Normalized`, 'Class Activation', isDefective ? 'Defective Tensor Activation' : 'Non-Defective Tensor Activation'],
    ['Defective Probability Score', `${inspection.confidence_scores?.Defective || (isDefective ? inspection.confidence : 0)}%`, 'Healthy Probability Score', `${inspection.confidence_scores?.Non_Defective || (!isDefective ? inspection.confidence : 0)}%`]
  ];

  doc.autoTable({
    startY: currentY + 3,
    body: gradCamData,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      textColor: [51, 65, 85]
    },
    margin: { left: 15, right: 15 }
  });

  currentY = doc.lastAutoTable.finalY + 12;

  // Verification
  doc.setDrawColor(203, 213, 225);
  doc.line(15, currentY, 195, currentY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryDark);
  doc.text('Inspection Lead / Engineer', 20, currentY + 8);
  doc.text('Track Maintenance Verification Cell', 130, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Verification Sign-off', 20, currentY + 13);
  doc.text(`Digital Token: ${inspection.inspection_token || 'RV-TRK-2026'}`, 130, currentY + 13);

  // Footer
  doc.setFillColor(...primaryDark);
  doc.rect(0, 287, 210, 10, 'F');
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(7);
  doc.text('RailVision AI • Deep Learning Track Defect Diagnostic System', 105, 293, { align: 'center' });

  const filename = `RailVision_Track_Report_${inspection.inspection_token || 'Report'}.pdf`;
  doc.save(filename);
}
