const Report = require('../models/report');
const Store = require('../models/store');
const User = require('../models/user');
const { sendStoreReportEmail } = require('../services/emails');

// Crear un reporte de tienda
exports.createReport = async (req, res) => {
    try {
        const { reporterId, storeId, reason, description } = req.body;

        // Validar que la tienda existe
        const store = await Store.findById(storeId);
        if (!store) {
            return res.status(404).json({ msg: 'Tienda no encontrada' });
        }

        // Validar que el usuario existe
        const reporter = await User.findById(reporterId);
        if (!reporter) {
            return res.status(404).json({ msg: 'Usuario no encontrado' });
        }

        // Verificar si ya existe un reporte del mismo usuario para la misma tienda
        const existingReport = await Report.findOne({
            reporterId,
            storeId,
            deletedAt: null
        });

        if (existingReport) {
            return res.status(400).json({ msg: 'Ya has reportado esta tienda anteriormente' });
        }

        const report = new Report({
            reporterId,
            storeId,
            reason,
            description
        });

        await report.save();

        // enviar email al admin sobre el nuevo reporte 
        // obtenemos los emails de los usuarios con role 'admin'
        const adminUsers = await User.find({ role: 'admin' });
        const adminEmails = adminUsers.map(admin => admin.email);

        await sendStoreReportEmail({
            storeName: store.name,
            storeId,
            reason,
            description,
            reporterEmail: reporter.email,
            reporterName: `${reporter.firstName} ${reporter.lastName}`
        });

        res.status(201).json({
            msg: 'Reporte enviado correctamente',
            report
        });
    } catch (error) {
        console.error('Error al crear el reporte:', error);
        res.status(500).json({ msg: 'Error del servidor al crear el reporte' });
    }
};

// Obtener todos los reportes (solo admin)
exports.getAllReports = async (req, res) => {
    try {
        const reports = await Report.find({ deletedAt: null })
            .populate('reporterId', 'firstName lastName email')
            .populate('storeId', 'name slug')
            .sort({ createdAt: -1 });

        res.json(reports);
    } catch (error) {
        console.error('Error al obtener reportes:', error);
        res.status(500).json({ msg: 'Error del servidor al obtener reportes' });
    }
};

// Obtener reportes de una tienda específica (solo admin)
exports.getReportsByStore = async (req, res) => {
    try {
        const { storeId } = req.params;

        const reports = await Report.find({ storeId, deletedAt: null })
            .populate('reporterId', 'firstName lastName email')
            .sort({ createdAt: -1 });

        res.json(reports);
    } catch (error) {
        console.error('Error al obtener reportes de la tienda:', error);
        res.status(500).json({ msg: 'Error del servidor al obtener reportes' });
    }
};

// Eliminar un reporte (soft delete)
exports.deleteReport = async (req, res) => {
    try {
        const { reportId } = req.params;

        const report = await Report.findByIdAndUpdate(
            reportId,
            { deletedAt: new Date() },
            { new: true }
        );

        if (!report) {
            return res.status(404).json({ msg: 'Reporte no encontrado' });
        }

        res.json({ msg: 'Reporte eliminado correctamente', report });
    } catch (error) {
        console.error('Error al eliminar el reporte:', error);
        res.status(500).json({ msg: 'Error del servidor al eliminar el reporte' });
    }
};

// Actualizar el estado de un reporte
exports.updateReportStatus = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { status } = req.body;

        // Validar que el estado es válido
        if (!['pending', 'reviewed', 'resolved'].includes(status)) {
            return res.status(400).json({ msg: 'Estado inválido' });
        }

        const report = await Report.findById(reportId);
        if (!report) {
            return res.status(404).json({ msg: 'Reporte no encontrado' });
        }

        if (report.deletedAt) {
            return res.status(400).json({ msg: 'No se puede actualizar un reporte eliminado' });
        }

        report.status = status;
        await report.save();

        res.json({ msg: 'Estado del reporte actualizado correctamente', report });
    } catch (error) {
        console.error('Error al actualizar estado del reporte:', error);
        res.status(500).json({ msg: 'Error del servidor' });
    }
};
