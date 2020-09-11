<?php
namespace Crypter\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Cookie;

use Sensio\Bundle\FrameworkExtraBundle\Configuration\IsGranted;

use Symfony\Component\Validator\Validator\ValidatorInterface;
use Symfony\Component\Validator\ConstraintViolationList;
use Symfony\Component\Security\Core\Encoder\UserPasswordEncoderInterface;

use Crypter\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

use Doctrine\DBAL\Exception\UniqueConstraintViolationException;

use \Firebase\JWT\JWT;

use \ReCaptcha\ReCaptcha;

class AuthController extends AbstractController
{
    private $validator;

    private $em;

    private $passwordEncoder;

    public function __construct(ValidatorInterface $validator, EntityManagerInterface $em, UserPasswordEncoderInterface $passwordEncoder)
    {
        $this->validator = $validator;
        $this->em = $em;
        $this->passwordEncoder = $passwordEncoder;
    }

    /**
     * @Route("/api/auth/registrate", methods={"POST"}, name="registrate")
     */
    public function registrate(Request $request): Response
    {
        // x-www-urlencoded or json
        $data = empty($request->request->all()) ? json_decode($request->getContent(), $assoc = true) : $request->request->all();

        if (
            !(array_key_exists('email', $data) && !empty($data['email'])) ||
            !(array_key_exists('name', $data) && !empty($data['name'])) ||
            !(array_key_exists('password', $data) && !empty($data['password'])) ||
            !(array_key_exists('fingerprint', $data) && !empty($data['fingerprint'])) ||
            !(array_key_exists('public_key', $data) && !empty($data['public_key'])) ||
            !(array_key_exists('private_key', $data) && !empty($data['private_key'])) ||
            !(array_key_exists('revocation_certificate', $data) && !empty($data['revocation_certificate']))
        ) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        if ($this->getParameter('APP_ENV') === 'prod') {
            if (!(array_key_exists('recaptcha_token', $data) && !empty($data['recaptcha_token']))) {
                return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
            }

            $recaptcha = new ReCaptcha($this->getParamter($this->getParamter('RECAPTCHA_SECRET')));

            $r = $recaptcha
                ->setExpectedHostname($request->getHost())
                ->verify($data['recaptcha_token']);

            if (!$r->isSuccess()) {
                return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
            }
        }

        $email = strtolower($data['email']);
        $name = $data['name'];
        $password = $data['password'];
        $fingerprint = $data['fingerprint'];
        $publicKey = $data['public_key'];
        $privateKey = $data['private_key'];
        $revocationCertificate = $data['revocation_certificate'];

        $user = new User();
        $user->setEmail(($email));
        $user->setName($name);
        $user->setPassword($password);
        $user->setFingerprint($fingerprint);
        $user->setPublicKey($publicKey);
        $user->setPrivateKey($privateKey);
        $user->setRevocationCertificate($revocationCertificate);
        
        $errors = $this->validator->validate($user);

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $user->setPassword($this->passwordEncoder->encodePassword($user, $password));

        try {
            $this->em->persist($user);
            $this->em->flush();
        } catch (UniqueConstraintViolationException $e) {
            return new Response('Bad Request: User with this email already exists', Response::HTTP_BAD_REQUEST);
        }

        $uuid = $user->getUuid();
        $hash = $user->getPassword();
        $lastSeen = (float) $user->getLastSeen()->format('U.u');
        $conferencesCount = $user->getConferencesCount();

        $jwt = JWT::encode(['uuid' => $uuid, 'hash' => $hash], $this->getParameter('JWT_SECRET'));

        $response = new JsonResponse([
            'uuid' => $uuid,
            'email' => $email,
            'name' => $name,
            'hash' => $jwt,
            'last_seen' => $lastSeen,
            'conferences_count' => $conferencesCount,
            'fingerprint' => $fingerprint,
            'public_key' => $publicKey,
            'private_key' => $privateKey,
            'revocation_certificate' => $revocationCertificate
        ]);

        // @TODO set secure flag to true when https will be implemented
        $response->headers->setCookie(new Cookie('uuid', $uuid, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('email', $email, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('name', $name, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('hash', $jwt, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('last_seen', $lastSeen, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('conferences_count', $conferencesCount, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));

        return $response;
    }

    /**
     * @Route("/api/auth/login", methods={"POST"}, name="login")
     */
    public function login(Request $request): Response
    {
        // x-www-urlencoded or json
        $data = empty($request->request->all()) ? json_decode($request->getContent(), $assoc = true) : $request->request->all();

        if (
            !(array_key_exists('email', $data) && !empty($data['email'])) ||
            !(array_key_exists('password', $data) && !empty($data['password']))
        ) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        if ($this->getParameter('APP_ENV') === 'prod') {
            if (!(array_key_exists('recaptcha_token', $data) && !empty($data['recaptcha_token']))) {
                return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
            }

            $recaptcha = new ReCaptcha($this->getParamter($this->getParamter('RECAPTCHA_SECRET')));

            $r = $recaptcha
                ->setExpectedHostname($request->getHost())
                ->verify($data['recaptcha_token']);

            if (!$r->isSuccess()) {
                return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
            }
        }

        $email = strtolower($data['email']);
        $password = $data['password'];

        $user = new User();
        $user->setEmail($email);
        $user->setPassword($password);

        $errors = new ConstraintViolationList();

        foreach ($this->validator->validateProperty($user, 'email') as $error) {
            $errors->add($error);
        }

        foreach ($this->validator->validateProperty($user, 'password') as $error) {
            $errors->add($error);
        }

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]);

        if (!$user or !$this->passwordEncoder->isPasswordValid($user, $password)) {
            return new Response('Not Found', Response::HTTP_NOT_FOUND);
        }

        $uuid = $user->getUuid();
        $email = $user->getEmail();
        $name = $user->getName();
        $hash = $user->getPassword();
        $lastSeen = (float) $user->getLastSeen()->format('U.u');
        $conferencesCount = $user->getConferencesCount();
        $fingerprint = $user->getFingerprint();
        $publicKey = $user->getPublicKey();
        $privateKey = $user->getPrivateKey();
        $revocationCertificate = $user->getRevocationCertificate();

        $jwt = JWT::encode(['uuid' => $uuid, 'hash' => $hash], $this->getParameter('JWT_SECRET'));

        $response = new JsonResponse([
            'uuid' => $uuid,
            'email' => $email,
            'name' => $name,
            'hash' => $jwt,
            'last_seen' => $lastSeen,
            'conferences_count' => $conferencesCount,
            'fingerprint' => $fingerprint,
            'public_key' => $publicKey,
            'private_key' => $privateKey,
            'revocation_certificate' => $revocationCertificate
        ]);

        // @TODO set secure flag to true when https will be implemented
        $response->headers->setCookie(new Cookie('uuid', $uuid, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('email', $email, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('name', $name, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('hash', $jwt, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('last_seen', $lastSeen, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));
        $response->headers->setCookie(new Cookie('conferences_count', $conferencesCount, $expire = strtotime('+1 year'), $path = '/', $domain = null, $secure = false, $httpOnly = true, $raw = false, $sameSite = null));

        return $response;
    }

    /**
      * @Route("/api/auth/logout", methods={"POST"}, name="logout")
      *
      * @IsGranted("ROLE_USER")
      */
     public function logout()
     {
         // controller can be blank: it will never be executed!
         throw new \Exception('Don\'t forget to activate logout in security.yaml');
     }

    /**
      * @Route("/api/auth/user/{uuid}", name="get_user")
      *
      * @IsGranted("ROLE_USER")
      */
    public function getUserInfo(Request $request, $uuid): Response
    {
        $user = $this->em->getRepository(User::class)->find($uuid);

        if (!$user) {
            return new Response('Not Found', Response::HTTP_NOT_FOUND);
        }

        $json = [
            'uuid' => $user->getUuid(),
            'name' => $user->getName(),
            'public_key' => $user->getPublicKey()
            // @TODO 'last_seen' => (float) $user->getLastSeen()->format('U.u')
        ];

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/auth/email/{email}", name="email_exists")
     */
    public function isEmailExists(string $email): Response
    {
        $email = strtolower($email);

        $user = new User();
        $user->setEmail($email);

        $errors = $this->validator->validateProperty($user, 'email');

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]);

        if (!$user) {
            return new Response('Not Found', Response::HTTP_NOT_FOUND);
        }

        return new Response('Exists', Response::HTTP_OK);
    }
}
