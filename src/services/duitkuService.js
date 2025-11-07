const crypto = require('crypto');
const axios = require('axios');

class DuitkuService {
    constructor() {
        this.merchantCode = process.env.DUITKU_MERCHANT_CODE;
        this.apiKey = process.env.DUITKU_API_KEY;
        this.isProduction = process.env.NODE_ENV === 'production';

        this.baseURL = this.isProduction
            ? 'https://passport.duitku.com/webapi/api/merchant'
            : 'https://sandbox.duitku.com/webapi/api/merchant';
    }

    /**
     * Generate MD5 signature for transaction request
     */
    generateSignature(merchantCode, merchantOrderId, paymentAmount, apiKey) {
        const signatureString = `${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}`;
        return crypto.createHash('md5').update(signatureString).digest('hex');
    }

    /**
     * Generate SHA256 signature for get payment method
     */
    generateSHA256Signature(merchantCode, paymentAmount, datetime, apiKey) {
        const signatureString = `${merchantCode}${paymentAmount}${datetime}${apiKey}`;
        return crypto.createHash('sha256').update(signatureString).digest('hex');
    }

    /**
     * Validate callback signature
     */
    validateCallbackSignature(merchantCode, amount, merchantOrderId, signature) {
        const calculatedSignature = crypto
            .createHash('md5')
            .update(`${merchantCode}${amount}${merchantOrderId}${this.apiKey}`)
            .digest('hex');

        return signature === calculatedSignature;
    }

    /**
     * Get available payment methods
     */
    async getPaymentMethods(amount = 45000) {
        try {
            const datetime = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const signature = this.generateSHA256Signature(
                this.merchantCode,
                amount,
                datetime,
                this.apiKey
            );

            const response = await axios.post(
                `${this.baseURL}/paymentmethod/getpaymentmethod`,
                {
                    merchantcode: this.merchantCode,
                    amount,
                    datetime,
                    signature
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.responseCode === '00') {
                return {
                    success: true,
                    data: response.data.paymentFee
                };
            }

            return {
                success: false,
                message: response.data.responseMessage
            };
        } catch (error) {
            console.error('Duitku Get Payment Methods Error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.Message || error.message
            };
        }
    }

    /**
     * Create transaction request
     */
    async createTransaction(data) {
        try {
            const {
                merchantOrderId,
                paymentAmount,
                paymentMethod,
                customerDetail,
                callbackUrl,
                returnUrl,
                expiryPeriod = 1440             } = data;

            const signature = this.generateSignature(
                this.merchantCode,
                merchantOrderId,
                paymentAmount,
                this.apiKey
            );

            const itemDetails = [
                {
                    name: 'Snaplove Premium Subscription - 1 Month',
                    price: paymentAmount,
                    quantity: 1
                }
            ];

            const payload = {
                merchantCode: this.merchantCode,
                paymentAmount,
                paymentMethod,
                merchantOrderId,
                productDetails: 'Snaplove Premium Subscription - 1 Month',
                customerVaName: customerDetail.firstName + ' ' + customerDetail.lastName,
                email: customerDetail.email,
                phoneNumber: customerDetail.phoneNumber || '-',
                itemDetails,
                customerDetail,
                callbackUrl,
                returnUrl,
                signature,
                expiryPeriod
            };

            const response = await axios.post(
                `${this.baseURL}/v2/inquiry`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.statusCode === '00') {
                return {
                    success: true,
                    data: {
                        merchantCode: response.data.merchantCode,
                        reference: response.data.reference,
                        paymentUrl: response.data.paymentUrl,
                        vaNumber: response.data.vaNumber,
                        qrString: response.data.qrString,
                        amount: response.data.amount,
                        statusMessage: response.data.statusMessage
                    }
                };
            }

            return {
                success: false,
                message: response.data.statusMessage
            };
        } catch (error) {
            console.error('Duitku Create Transaction Error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.Message || error.message
            };
        }
    }

    /**
     * Check transaction status
     */
    async checkTransactionStatus(merchantOrderId) {
        try {
            const signature = this.generateSignature(
                this.merchantCode,
                merchantOrderId,
                0,                 this.apiKey
            );

            const response = await axios.post(
                `${this.baseURL}/transactionStatus`,
                {
                    merchantCode: this.merchantCode,
                    merchantOrderId,
                    signature
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                success: true,
                data: {
                    merchantOrderId: response.data.merchantOrderId,
                    reference: response.data.reference,
                    amount: response.data.amount,
                    fee: response.data.fee,
                    statusCode: response.data.statusCode,
                    statusMessage: response.data.statusMessage
                }
            };
        } catch (error) {
            console.error('Duitku Check Status Error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.Message || error.message
            };
        }
    }

    /**
     * Process callback from Duitku
     */
    processCallback(callbackData) {
        const {
            merchantCode,
            amount,
            merchantOrderId,
            _productDetail,
            _additionalParam,
            paymentCode,
            resultCode,
            merchantUserId,
            reference,
            signature,
            publisherOrderId,
            _spUserHash,
            settlementDate,
            issuerCode
        } = callbackData;

        const isValid = this.validateCallbackSignature(
            merchantCode,
            amount,
            merchantOrderId,
            signature
        );

        if (!isValid) {
            return {
                success: false,
                message: 'Invalid signature'
            };
        }

        let status = 'pending';
        if (resultCode === '00') {
            status = 'success';
        } else if (resultCode === '01') {
            status = 'failed';
        }

        return {
            success: true,
            data: {
                merchantOrderId,
                reference,
                amount: parseInt(amount),
                paymentCode,
                status,
                publisherOrderId,
                settlementDate,
                issuerCode,
                merchantUserId
            }
        };
    }
}

module.exports = new DuitkuService();
