const Address = require("../models/address");

// Obtener todas las direcciones del usuario
const getUserAddresses = async (req, res) => {
    try {
        const userId = req.user.id;
        const addresses = await Address.find({
            userId,
            deletedAt: { $exists: false }
        }).sort({ createdAt: -1 });

        res.status(200).json(addresses);
    } catch (error) {
        return res.status(400).send({ msg: error.message });
    }
};

// Obtener una dirección específica
const getAddressById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const address = await Address.findOne({
            _id: id,
            userId,
            deletedAt: { $exists: false }
        });

        if (!address) {
            return res.status(404).send({ msg: "Dirección no encontrada" });
        }

        res.status(200).json(address);
    } catch (error) {
        return res.status(400).send({ msg: error.message });
    }
};

// Crear una nueva dirección
const createAddress = async (req, res) => {
    try {
        const { title, street, city, state, postalCode, country, phoneNumber, isDefault } = req.body;
        const userId = req.user.id;

        // Validar campos requeridos
        if (!title || !street || !city || !state || !postalCode || !phoneNumber) {
            return res.status(400).send({ msg: "Faltan campos requeridos" });
        }

        // Si isDefault es true, actualizar otras direcciones del usuario
        if (isDefault) {
            await Address.updateMany(
                { userId, deletedAt: { $exists: false } },
                { isDefault: false }
            );
        }

        const newAddress = new Address({
            userId,
            title,
            street,
            city,
            state,
            postalCode,
            country: country || 'España',
            phoneNumber,
            isDefault: isDefault || false
        });

        const savedAddress = await newAddress.save();
        res.status(201).json({ msg: "Dirección creada exitosamente", address: savedAddress });
    } catch (error) {
        return res.status(400).send({ msg: error.message });
    }
};

// Actualizar una dirección
const updateAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { title, street, city, state, postalCode, country, phoneNumber, isDefault } = req.body;

        const address = await Address.findOne({
            _id: id,
            userId,
            deletedAt: { $exists: false }
        });

        if (!address) {
            return res.status(404).send({ msg: "Dirección no encontrada" });
        }

        // Si isDefault es true, actualizar otras direcciones
        if (isDefault && !address.isDefault) {
            await Address.updateMany(
                { userId, deletedAt: { $exists: false }, _id: { $ne: id } },
                { isDefault: false }
            );
        }

        // Actualizar campos
        if (title) address.title = title;
        if (street) address.street = street;
        if (city) address.city = city;
        if (state) address.state = state;
        if (postalCode) address.postalCode = postalCode;
        if (country) address.country = country;
        if (phoneNumber) address.phoneNumber = phoneNumber;
        if (typeof isDefault === 'boolean') address.isDefault = isDefault;

        const updatedAddress = await address.save();
        res.status(200).json({ msg: "Dirección actualizada exitosamente", address: updatedAddress });
    } catch (error) {
        return res.status(400).send({ msg: error.message });
    }
};

// Eliminar una dirección (soft delete)
const deleteAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const address = await Address.findOne({
            _id: id,
            userId,
            deletedAt: { $exists: false }
        });

        if (!address) {
            return res.status(404).send({ msg: "Dirección no encontrada" });
        }

        // Si era la dirección por defecto, marcar otra como default
        if (address.isDefault) {
            const nextAddress = await Address.findOne({
                userId,
                _id: { $ne: id },
                deletedAt: { $exists: false }
            });
            if (nextAddress) {
                nextAddress.isDefault = true;
                await nextAddress.save();
            }
        }

        address.deletedAt = new Date();
        await address.save();

        res.status(200).json({ msg: "Dirección eliminada exitosamente" });
    } catch (error) {
        return res.status(400).send({ msg: error.message });
    }
};

// Establecer dirección como predeterminada
const setDefaultAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const address = await Address.findOne({
            _id: id,
            userId,
            deletedAt: { $exists: false }
        });

        if (!address) {
            return res.status(404).send({ msg: "Dirección no encontrada" });
        }

        // Actualizar todas las direcciones del usuario
        await Address.updateMany(
            { userId, deletedAt: { $exists: false } },
            { isDefault: false }
        );

        // Establecer como default
        address.isDefault = true;
        const updatedAddress = await address.save();

        res.status(200).json({ msg: "Dirección establecida como predeterminada", address: updatedAddress });
    } catch (error) {
        return res.status(400).send({ msg: error.message });
    }
};

module.exports = {
    getUserAddresses,
    getAddressById,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
};
