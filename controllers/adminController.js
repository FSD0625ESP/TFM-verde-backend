const Order = require('../models/order');
const User = require('../models/user');
const Store = require('../models/store');
const Product = require('../models/product');
const Report = require('../models/report');

/**
 * Obtener estadísticas globales para el panel de administración
 * Consultas optimizadas usando agregaciones de MongoDB
 */
exports.getGlobalStats = async (req, res) => {
    try {
        // Verificar que el usuario sea admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Acceso denegado. Solo administradores.' });
        }

        // Ejecutar todas las consultas en paralelo para optimizar el rendimiento
        const [
            ordersStats,
            usersStats,
            storesStats,
            productsStats,
            reportsCount,
            reportsData
        ] = await Promise.all([
            // Estadísticas de pedidos y ventas
            Order.aggregate([
                // Primero calculamos el totalAmount para cada orden
                {
                    $addFields: {
                        totalAmount: {
                            $reduce: {
                                input: '$items',
                                initialValue: 0,
                                in: { $add: ['$$value', { $multiply: ['$$this.price', '$$this.quantity'] }] }
                            }
                        }
                    }
                },
                {
                    $facet: {
                        totalOrders: [{ $count: 'count' }],
                        totalRevenue: [
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: '$totalAmount' }
                                }
                            }
                        ],
                        ordersByStatus: [
                            {
                                $group: {
                                    _id: '$status',
                                    count: { $count: {} }
                                }
                            }
                        ],
                        recentOrders: [
                            { $sort: { createdAt: -1 } },
                            { $limit: 10 },
                            {
                                $lookup: {
                                    from: 'users',
                                    localField: 'customerId',
                                    foreignField: '_id',
                                    as: 'user'
                                }
                            },
                            {
                                $lookup: {
                                    from: 'stores',
                                    localField: 'storeId',
                                    foreignField: '_id',
                                    as: 'store'
                                }
                            },
                            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                            { $unwind: { path: '$store', preserveNullAndEmptyArrays: true } },
                            {
                                $project: {
                                    _id: 1,
                                    orderNumber: 1,
                                    totalAmount: 1,
                                    status: 1,
                                    createdAt: 1,
                                    user: {
                                        firstName: '$user.firstName',
                                        lastName: '$user.lastName'
                                    },
                                    store: {
                                        name: '$store.name'
                                    }
                                }
                            }
                        ],
                        ordersToday: [
                            {
                                $match: {
                                    createdAt: {
                                        $gte: new Date(new Date().setHours(0, 0, 0, 0))
                                    }
                                }
                            },
                            { $count: 'count' }
                        ],
                        revenueToday: [
                            {
                                $match: {
                                    createdAt: {
                                        $gte: new Date(new Date().setHours(0, 0, 0, 0))
                                    }
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: '$totalAmount' }
                                }
                            }
                        ]
                    }
                }
            ]),

            // Estadísticas de usuarios
            User.aggregate([
                {
                    $facet: {
                        totalUsers: [{ $count: 'count' }],
                        usersByRole: [
                            {
                                $group: {
                                    _id: '$role',
                                    count: { $count: {} }
                                }
                            }
                        ],
                        newUsersToday: [
                            {
                                $match: {
                                    createdAt: {
                                        $gte: new Date(new Date().setHours(0, 0, 0, 0))
                                    }
                                }
                            },
                            { $count: 'count' }
                        ],
                        newUsersThisMonth: [
                            {
                                $match: {
                                    createdAt: {
                                        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                                    }
                                }
                            },
                            { $count: 'count' }
                        ]
                    }
                }
            ]),

            // Estadísticas de tiendas
            Store.aggregate([
                {
                    $facet: {
                        totalStores: [{ $count: 'count' }],
                        activeStores: [
                            { $match: { active: true } },
                            { $count: 'count' }
                        ],
                        inactiveStores: [
                            { $match: { active: false } },
                            { $count: 'count' }
                        ],
                        newStoresToday: [
                            {
                                $match: {
                                    createdAt: {
                                        $gte: new Date(new Date().setHours(0, 0, 0, 0))
                                    }
                                }
                            },
                            { $count: 'count' }
                        ]
                    }
                }
            ]),

            // Estadísticas de productos
            Product.aggregate([
                {
                    $facet: {
                        totalProducts: [{ $count: 'count' }],
                        activeProducts: [
                            { $match: { active: true } },
                            { $count: 'count' }
                        ],
                        featuredProducts: [
                            { $match: { destacado: true } },
                            { $count: 'count' }
                        ],
                        productsOnOffer: [
                            { $match: { oferta: true } },
                            { $count: 'count' }
                        ]
                    }
                }
            ]),

            // Contar reportes pendientes
            Report.countDocuments({ deletedAt: null }),

            // Obtener reportes detallados
            Report.find({ deletedAt: null })
                .select('reporterId storeId reason description status createdAt')
                .populate('reporterId', 'firstName lastName email')
                .populate('storeId', 'name slug')
                .sort({ createdAt: -1 })
                .limit(50)
        ]);

        // Formatear la respuesta
        const response = {
            orders: {
                total: ordersStats[0].totalOrders[0]?.count || 0,
                today: ordersStats[0].ordersToday[0]?.count || 0,
                byStatus: ordersStats[0].ordersByStatus.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                recent: ordersStats[0].recentOrders
            },
            revenue: {
                total: ordersStats[0].totalRevenue[0]?.total || 0,
                today: ordersStats[0].revenueToday[0]?.total || 0
            },
            users: {
                total: usersStats[0].totalUsers[0]?.count || 0,
                newToday: usersStats[0].newUsersToday[0]?.count || 0,
                newThisMonth: usersStats[0].newUsersThisMonth[0]?.count || 0,
                byRole: usersStats[0].usersByRole.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            },
            stores: {
                total: storesStats[0].totalStores[0]?.count || 0,
                active: storesStats[0].activeStores[0]?.count || 0,
                inactive: storesStats[0].inactiveStores[0]?.count || 0,
                newToday: storesStats[0].newStoresToday[0]?.count || 0
            },
            products: {
                total: productsStats[0].totalProducts[0]?.count || 0,
                active: productsStats[0].activeProducts[0]?.count || 0,
                featured: productsStats[0].featuredProducts[0]?.count || 0,
                onOffer: productsStats[0].productsOnOffer[0]?.count || 0
            },
            reports: {
                pending: reportsCount,
                list: reportsData
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Error al obtener estadísticas globales:', error);
        res.status(500).json({ msg: 'Error del servidor al obtener estadísticas' });
    }
};
