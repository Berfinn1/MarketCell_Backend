const express = require('express');
const authV1Routes = require('./routes/v1/auth.routes');
const productsV1Routes = require('./routes/v1/products.routes');
const ordersV1Routes = require('./routes/v1/orders.routes');
const sellerV1Routes = require('./routes/v1/seller.routes');
const { errorHandler } = require('./middlewares/errorHandler');
const { sendError } = require('./utils/apiResponse');

const app = express();

app.use(express.json());

app.use('/api/v1/auth', authV1Routes);
app.use('/api/v1/products', productsV1Routes);
app.use('/api/v1/orders', ordersV1Routes);
app.use('/api/v1/seller', sellerV1Routes);

app.use((req, res) => {
  sendError(res, 404, 'Kaynak bulunamadı', 'NOT_FOUND');
});

app.use(errorHandler);

module.exports = app;
